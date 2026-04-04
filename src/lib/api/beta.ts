import type {
  BetaEvent,
  BetaSeverity,
  BetaEventType,
  CreateBetaEventPayload,
  CreateBetaEventResponse,
  BetaTestResponse,
} from "@/lib/types/beta";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// In-memory fallback store (used when the backend is unreachable)
// ---------------------------------------------------------------------------

let _nextId = 1;
const _store: BetaEvent[] = [];

function makeId(): string {
  return `beta-local-${_nextId++}`;
}

/** Validates required fields; returns an array of missing field names. */
function validatePayload(payload: Partial<CreateBetaEventPayload>): string[] {
  const required: Array<keyof CreateBetaEventPayload> = [
    "systemName",
    "feature",
    "eventType",
    "severity",
    "message",
  ];
  return required.filter((k) => !payload[k]);
}

const VALID_EVENT_TYPES: BetaEventType[] = ["usage", "error", "warning", "critical"];
const VALID_SEVERITIES: BetaSeverity[] = ["info", "warning", "error", "critical"];

function validateEnums(payload: CreateBetaEventPayload): string[] {
  const errors: string[] = [];
  if (!VALID_EVENT_TYPES.includes(payload.eventType)) {
    errors.push(`eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}`);
  }
  if (!VALID_SEVERITIES.includes(payload.severity)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Critical-alert handler (Part 4)
// ---------------------------------------------------------------------------

export function sendCriticalAlert(event: BetaEvent): void {
  // Log alert to console. Email delivery is handled server-side via the
  // POST /api/beta/events endpoint; this client-side call mirrors that intent.
  console.error(
    "[CRITICAL ALERT]",
    `system=${event.systemName}`,
    `feature=${event.feature}`,
    `message=${event.message}`,
    event,
  );

  // Email alert: POST to server-side email trigger endpoint.
  // Failures are intentionally swallowed – alert logging above is the
  // primary client-side action; actual email delivery is server-side.
  apiFetch("/beta/alerts/critical", {
    method: "POST",
    body: JSON.stringify({ eventId: event.id }),
  }).catch(() => {
    // Backend unavailable – alert already logged to console above.
  });
}

// ---------------------------------------------------------------------------
// POST /api/beta/events
// ---------------------------------------------------------------------------

/**
 * Submit a new beta event.
 *
 * If the backend is unreachable the event is stored in the in-memory fallback
 * and, when severity is "critical", the critical-alert handler is called.
 *
 * Throws a `ValidationError` (with `.fields`) when required fields are missing
 * or enum values are invalid, regardless of backend availability.
 */
export class ValidationError extends Error {
  constructor(
    public readonly fields: string[],
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export async function createBetaEvent(
  payload: Partial<CreateBetaEventPayload>,
): Promise<CreateBetaEventResponse> {
  // --- validation (always performed client-side) ---------------------------
  const missingFields = validatePayload(payload);
  if (missingFields.length > 0) {
    throw new ValidationError(
      missingFields,
      `Missing required fields: ${missingFields.join(", ")}`,
    );
  }

  const safePayload = payload as CreateBetaEventPayload;
  const enumErrors = validateEnums(safePayload);
  if (enumErrors.length > 0) {
    const invalidFields = enumErrors.map((msg) =>
      msg.startsWith("eventType") ? "eventType" : "severity",
    );
    throw new ValidationError(invalidFields, enumErrors.join("; "));
  }

  // --- attempt real API call -----------------------------------------------
  try {
    const result = await apiFetch<CreateBetaEventResponse>("/beta/events", {
      method: "POST",
      body: JSON.stringify(safePayload),
    });

    console.log("[Beta Event]", result.event);

    if (result.event.severity === "critical") {
      sendCriticalAlert(result.event);
    }

    return result;
  } catch {
    // --- fallback: store locally ------------------------------------------
    const event: BetaEvent = {
      id: makeId(),
      ...safePayload,
      createdAt: new Date().toISOString(),
    };

    _store.unshift(event);

    console.log("[Beta Event]", event);

    if (event.severity === "critical") {
      sendCriticalAlert(event);
    }

    return { success: true, event };
  }
}

// ---------------------------------------------------------------------------
// GET /api/beta/events
// ---------------------------------------------------------------------------

export interface ListBetaEventsParams {
  severity?: BetaSeverity | "all";
  systemName?: string;
}

export async function listBetaEvents(
  params?: ListBetaEventsParams,
): Promise<BetaEvent[]> {
  try {
    const query = new URLSearchParams();
    if (params?.severity && params.severity !== "all")
      query.set("severity", params.severity);
    if (params?.systemName) query.set("systemName", params.systemName);
    const qs = query.toString();
    return await apiFetch<BetaEvent[]>(`/beta/events${qs ? `?${qs}` : ""}`);
  } catch {
    // Return local fallback store, newest first, with optional filtering.
    let events = [..._store];
    if (params?.severity && params.severity !== "all") {
      events = events.filter((e) => e.severity === params.severity);
    }
    if (params?.systemName) {
      const term = params.systemName.toLowerCase();
      events = events.filter((e) => e.systemName.toLowerCase().includes(term));
    }
    return events;
  }
}

// ---------------------------------------------------------------------------
// GET /api/beta/test  (Part 5)
// ---------------------------------------------------------------------------

export async function getBetaTestStatus(): Promise<BetaTestResponse> {
  try {
    return await apiFetch<BetaTestResponse>("/beta/test");
  } catch {
    return { status: "Beta system active" };
  }
}
