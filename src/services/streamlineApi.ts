import type { Room, RoomStatus, ServiceStatus } from "@/lib/types/admin";

const STREAMLINE_API_BASE_URL = import.meta.env.VITE_STREAMLINE_API_BASE_URL;
const STREAMLINE_API_TOKEN = import.meta.env.VITE_STREAMLINE_API_TOKEN;
const SUPPORT_DATA_SOURCE = import.meta.env.VITE_SUPPORT_DATA_SOURCE;
const REQUEST_TIMEOUT_MS = 10_000;

const STATUS_ENDPOINT = "/api/horizon/bot/support/status";
const ROOMS_ENDPOINT = "/api/horizon/bot/support/rooms";
const ROOM_DETAIL_ENDPOINT = "/api/horizon/bot/support/rooms/:roomId";
const ROOM_CHAT_ENDPOINT = "/api/horizon/bot/support/rooms/:roomId/chat";

export interface StreamlineSupportStatus {
  connected: boolean;
  status: ServiceStatus;
  message?: string;
  checkedAt: string;
}

export interface StreamlineRoomDetails extends Room {
  description?: string;
}

export interface StreamlineRoomChatMessage {
  id: string;
  roomId: string;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface StreamlineDiagnostics {
  configured: boolean;
  baseUrl: string;
  supportDataSource?: string;
  authConfigured: boolean;
  strictValidation: boolean;
  lastUpdatedAt?: string;
  lastSuccessfulConnectionAt?: string;
  lastFailedConnectionAt?: string;
  lastEndpoint?: string;
  lastUrl?: string;
  lastDurationMs?: number;
  lastStatusCode?: number;
  lastErrorType?: "config" | "http" | "network" | "timeout" | "validation";
  lastErrorMessage?: string;
  lastValidationDetails?: string[];
  endpointChecks: StreamlineEndpointCheck[];
  validationChecks: StreamlineValidationCheck[];
  polling: StreamlinePollingHealth;
  recentErrors: StreamlineRecentError[];
}

export interface StreamlineEndpointCheck {
  endpoint: string;
  reachable: boolean | null;
  httpStatusCode?: number;
  responseTimeMs?: number;
  validationPassed: boolean | null;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  errorMessage?: string;
}

export interface StreamlineValidationCheck {
  key: "support-status" | "rooms" | "room-detail" | "room-chat";
  endpoint: string;
  valid: boolean | null;
  details: string[];
}

export interface StreamlinePollingHealth {
  enabled: boolean;
  intervalMs?: number;
  lastPollAttemptAt?: string;
  consecutiveFailures: number;
}

export interface StreamlineRecentError {
  timestamp: string;
  endpoint: string;
  category: "network" | "timeout" | "auth" | "validation" | "http" | "config";
  message: string;
}

type UnknownRecord = Record<string, unknown>;

interface RoomContract {
  id: string;
  name?: string;
  status: string;
  hostUid?: string | null;
  participantCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  isLive?: boolean;
}

interface RoomDetailContract extends RoomContract {
  chat?: {
    enabled?: boolean;
    activeSessionId?: string | null;
  };
}

interface RoomChatContract {
  id: string;
  text: string;
  senderIdentity?: string | null;
  senderName?: string | null;
  senderRole?: string | null;
  isAgent?: boolean;
  createdAt?: string | null;
}

export class StreamlineValidationError extends Error {
  readonly endpoint: string;
  readonly details: string[];

  constructor(endpoint: string, details: string[]) {
    super(`[${endpoint}] StreamLine returned unexpected data: ${details.join("; ")}`);
    this.name = "StreamlineValidationError";
    this.endpoint = endpoint;
    this.details = details;
  }
}

export function isStreamlineValidationError(error: unknown): error is StreamlineValidationError {
  return error instanceof StreamlineValidationError;
}

const diagnosticsState: StreamlineDiagnostics = {
  configured: false,
  baseUrl: "",
  supportDataSource: SUPPORT_DATA_SOURCE,
  authConfigured: Boolean(STREAMLINE_API_TOKEN),
  strictValidation: true,
  endpointChecks: [
    { endpoint: STATUS_ENDPOINT, reachable: null, validationPassed: null },
    { endpoint: ROOMS_ENDPOINT, reachable: null, validationPassed: null },
    { endpoint: ROOM_DETAIL_ENDPOINT, reachable: null, validationPassed: null },
    { endpoint: ROOM_CHAT_ENDPOINT, reachable: null, validationPassed: null },
  ],
  validationChecks: [
    { key: "support-status", endpoint: STATUS_ENDPOINT, valid: null, details: [] },
    { key: "rooms", endpoint: ROOMS_ENDPOINT, valid: null, details: [] },
    { key: "room-detail", endpoint: ROOM_DETAIL_ENDPOINT, valid: null, details: [] },
    { key: "room-chat", endpoint: ROOM_CHAT_ENDPOINT, valid: null, details: [] },
  ],
  polling: {
    enabled: false,
    intervalMs: undefined,
    lastPollAttemptAt: undefined,
    consecutiveFailures: 0,
  },
  recentErrors: [],
};

function updateDiagnostics(patch: Partial<StreamlineDiagnostics>): void {
  Object.assign(diagnosticsState, patch, { lastUpdatedAt: new Date().toISOString() });
}

function normalizeEndpointPath(path: string): string {
  if (/^\/api\/horizon\/bot\/support\/rooms\/[^/]+\/chat$/i.test(path)) {
    return ROOM_CHAT_ENDPOINT;
  }
  if (/^\/api\/horizon\/bot\/support\/rooms\/[^/]+$/i.test(path)) {
    return ROOM_DETAIL_ENDPOINT;
  }
  return path;
}

function validationKeyForEndpoint(endpoint: string): StreamlineValidationCheck["key"] | undefined {
  const normalized = normalizeEndpointPath(endpoint);
  if (normalized === STATUS_ENDPOINT) return "support-status";
  if (normalized === ROOMS_ENDPOINT) return "rooms";
  if (normalized === ROOM_DETAIL_ENDPOINT) return "room-detail";
  if (normalized === ROOM_CHAT_ENDPOINT) return "room-chat";
  return undefined;
}

function upsertEndpointCheck(endpoint: string, patch: Partial<StreamlineEndpointCheck>): void {
  const normalized = normalizeEndpointPath(endpoint);
  const existing = diagnosticsState.endpointChecks.find((item) => item.endpoint === normalized);
  if (existing) {
    Object.assign(existing, patch);
    return;
  }

  diagnosticsState.endpointChecks.push({
    endpoint: normalized,
    reachable: null,
    validationPassed: null,
    ...patch,
  });
}

function setValidationCheck(
  key: StreamlineValidationCheck["key"],
  endpoint: string,
  valid: boolean,
  details: string[] = [],
): void {
  const existing = diagnosticsState.validationChecks.find((item) => item.key === key);
  if (existing) {
    existing.endpoint = endpoint;
    existing.valid = valid;
    existing.details = details;
    return;
  }

  diagnosticsState.validationChecks.push({ key, endpoint, valid, details });
}

function pushRecentError(error: StreamlineRecentError): void {
  diagnosticsState.recentErrors = [error, ...diagnosticsState.recentErrors].slice(0, 10);
}

function markSuccess(endpoint: string, statusCode: number, responseTimeMs: number): void {
  const timestamp = new Date().toISOString();
  updateDiagnostics({
    lastSuccessfulConnectionAt: timestamp,
    lastEndpoint: normalizeEndpointPath(endpoint),
    lastStatusCode: statusCode,
    lastDurationMs: responseTimeMs,
    lastErrorType: undefined,
    lastErrorMessage: undefined,
    lastValidationDetails: undefined,
  });
  upsertEndpointCheck(endpoint, {
    reachable: true,
    httpStatusCode: statusCode,
    responseTimeMs,
    lastSuccessAt: timestamp,
    errorMessage: undefined,
  });
}

function markFailure(
  endpoint: string,
  category: StreamlineRecentError["category"],
  message: string,
  patch?: Partial<StreamlineEndpointCheck>,
): void {
  const timestamp = new Date().toISOString();
  updateDiagnostics({
    lastFailedConnectionAt: timestamp,
    lastEndpoint: normalizeEndpointPath(endpoint),
    lastErrorType: category,
    lastErrorMessage: message,
  });
  upsertEndpointCheck(endpoint, {
    reachable: false,
    lastFailureAt: timestamp,
    errorMessage: message,
    ...patch,
  });
  pushRecentError({
    timestamp,
    endpoint: normalizeEndpointPath(endpoint),
    category,
    message,
  });
}

export function getStreamlineDiagnostics(): StreamlineDiagnostics {
  const baseUrl = normalizeBaseUrl(STREAMLINE_API_BASE_URL);
  diagnosticsState.baseUrl = baseUrl;
  diagnosticsState.configured = Boolean(baseUrl);
  diagnosticsState.supportDataSource = SUPPORT_DATA_SOURCE;
  diagnosticsState.authConfigured = Boolean(STREAMLINE_API_TOKEN);
  diagnosticsState.strictValidation = true;
  return { ...diagnosticsState };
}

export function clearStreamlineDiagnostics(): void {
  diagnosticsState.lastUpdatedAt = undefined;
  diagnosticsState.lastSuccessfulConnectionAt = undefined;
  diagnosticsState.lastFailedConnectionAt = undefined;
  diagnosticsState.lastEndpoint = undefined;
  diagnosticsState.lastUrl = undefined;
  diagnosticsState.lastDurationMs = undefined;
  diagnosticsState.lastStatusCode = undefined;
  diagnosticsState.lastErrorType = undefined;
  diagnosticsState.lastErrorMessage = undefined;
  diagnosticsState.lastValidationDetails = undefined;
  diagnosticsState.endpointChecks = [
    { endpoint: STATUS_ENDPOINT, reachable: null, validationPassed: null },
    { endpoint: ROOMS_ENDPOINT, reachable: null, validationPassed: null },
    { endpoint: ROOM_DETAIL_ENDPOINT, reachable: null, validationPassed: null },
    { endpoint: ROOM_CHAT_ENDPOINT, reachable: null, validationPassed: null },
  ];
  diagnosticsState.validationChecks = [
    { key: "support-status", endpoint: STATUS_ENDPOINT, valid: null, details: [] },
    { key: "rooms", endpoint: ROOMS_ENDPOINT, valid: null, details: [] },
    { key: "room-detail", endpoint: ROOM_DETAIL_ENDPOINT, valid: null, details: [] },
    { key: "room-chat", endpoint: ROOM_CHAT_ENDPOINT, valid: null, details: [] },
  ];
  diagnosticsState.polling = {
    enabled: false,
    intervalMs: undefined,
    lastPollAttemptAt: undefined,
    consecutiveFailures: 0,
  };
  diagnosticsState.recentErrors = [];
}

export function updateStreamlinePollingHealth(params: {
  enabled: boolean;
  intervalMs?: number;
  success?: boolean;
}): void {
  const next = diagnosticsState.polling;
  next.enabled = params.enabled;
  next.intervalMs = params.intervalMs;
  next.lastPollAttemptAt = new Date().toISOString();
  if (params.success === true) {
    next.consecutiveFailures = 0;
  } else if (params.success === false) {
    next.consecutiveFailures += 1;
  }
}

export async function runStreamlineDiagnosticsChecks(): Promise<StreamlineDiagnostics> {
  clearStreamlineDiagnostics();

  try {
    await fetchSupportStatus();
  } catch {
    // diagnostics state is updated by the client
  }

  let firstRoomId: string | undefined;
  try {
    const rooms = await fetchRooms();
    firstRoomId = rooms[0]?.id;
  } catch {
    // diagnostics state is updated by the client
  }

  if (firstRoomId) {
    try {
      await fetchRoomDetails(firstRoomId);
    } catch {
      // diagnostics state is updated by the client
    }

    try {
      await fetchRoomChat(firstRoomId);
    } catch {
      // diagnostics state is updated by the client
    }
  }

  return getStreamlineDiagnostics();
}

export function formatStreamlineDiagnosticsReport(diagnostics = getStreamlineDiagnostics()): string {
  const lines = [
    "StreamLine Diagnostics Report",
    `Mode: ${diagnostics.supportDataSource || "default"}`,
    `Base URL: ${diagnostics.baseUrl || "-"}`,
    `Auth Configured: ${diagnostics.authConfigured ? "yes" : "no"}`,
    `Strict Validation: ${diagnostics.strictValidation ? "yes" : "no"}`,
    `Last Success: ${diagnostics.lastSuccessfulConnectionAt || "-"}`,
    `Last Failure: ${diagnostics.lastFailedConnectionAt || "-"}`,
    "",
    "Endpoint Checks:",
    ...diagnostics.endpointChecks.map((item) => (
      `${item.endpoint} | reachable=${item.reachable === null ? "unknown" : item.reachable ? "yes" : "no"} | status=${item.httpStatusCode ?? "-"} | validation=${item.validationPassed === null ? "unknown" : item.validationPassed ? "pass" : "fail"} | error=${item.errorMessage || "-"}`
    )),
    "",
    "Recent Errors:",
    ...diagnostics.recentErrors.map((item) => `${item.timestamp} | ${item.endpoint} | ${item.category} | ${item.message}`),
  ];

  return lines.join("\n");
}

function normalizeBaseUrl(url?: string): string {
  return (url ?? "").replace(/\/$/, "");
}

export function isStreamlineConfigured(): boolean {
  const explicitStreamline = (SUPPORT_DATA_SOURCE ?? "").toLowerCase() === "streamline";
  return explicitStreamline || Boolean(normalizeBaseUrl(STREAMLINE_API_BASE_URL));
}

function coerceRoomStatus(value: unknown): RoomStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "active" || raw === "live") return "active";
  if (raw === "idle") return "idle";
  if (raw === "closed" || raw === "ended") return "closed";
  if (raw === "error" || raw === "failed") return "error";
  return "idle";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function assertObject(endpoint: string, payload: unknown, field = "response"): UnknownRecord {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as UnknownRecord;
  }
  throwValidation(endpoint, [`${field} must be an object`], payload);
}

function throwValidation(endpoint: string, details: string[], payload: unknown): never {
  const validationKey = validationKeyForEndpoint(endpoint);
  updateDiagnostics({
    lastEndpoint: endpoint,
    lastErrorType: "validation",
    lastErrorMessage: "StreamLine returned unexpected data",
    lastValidationDetails: details,
  });
  upsertEndpointCheck(endpoint, {
    validationPassed: false,
    reachable: true,
  });
  if (validationKey) {
    setValidationCheck(validationKey, normalizeEndpointPath(endpoint), false, details);
  }
  markFailure(endpoint, "validation", "StreamLine returned unexpected data", {
    validationPassed: false,
  });

  if (import.meta.env.DEV) {
    console.error("[streamlineApi] Contract validation failed", {
      endpoint,
      details,
      payload,
    });
  }
  throw new StreamlineValidationError(endpoint, details);
}

function validateOptionalString(
  obj: UnknownRecord,
  field: string,
  details: string[],
  allowNull = false,
): string | null | undefined {
  const value = obj[field];
  if (value === undefined) return undefined;
  if (value === null && allowNull) return null;
  if (typeof value === "string") return value;
  details.push(`${field} must be a string${allowNull ? " or null" : ""}`);
  return undefined;
}

function validateOptionalNumber(obj: UnknownRecord, field: string, details: string[]): number | undefined {
  const value = obj[field];
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  details.push(`${field} must be a number`);
  return undefined;
}

function validateOptionalBoolean(obj: UnknownRecord, field: string, details: string[]): boolean | undefined {
  const value = obj[field];
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  details.push(`${field} must be a boolean`);
  return undefined;
}

function validateRoomStatus(endpoint: string, value: string, details: string[]): RoomStatus {
  const normalized = value.toLowerCase();
  if (normalized === "active" || normalized === "live") return "active";
  if (normalized === "idle") return "idle";
  if (normalized === "closed" || normalized === "ended") return "closed";
  if (normalized === "error" || normalized === "failed") return "error";
  details.push(`status value '${value}' is not supported`);
  return "idle";
}

function parseRoomContract(endpoint: string, payload: unknown): RoomContract {
  const details: string[] = [];
  const obj = assertObject(endpoint, payload, "room");

  const id = obj.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    details.push("id is required and must be a non-empty string");
  }

  const status = obj.status;
  if (typeof status !== "string" || status.trim().length === 0) {
    details.push("status is required and must be a non-empty string");
  }

  const name = validateOptionalString(obj, "name", details);
  const hostUid = validateOptionalString(obj, "hostUid", details, true);
  const participantCount = validateOptionalNumber(obj, "participantCount", details);
  const createdAt = validateOptionalString(obj, "createdAt", details, true);
  const updatedAt = validateOptionalString(obj, "updatedAt", details, true);
  const isLive = validateOptionalBoolean(obj, "isLive", details);

  if (details.length > 0) {
    throwValidation(endpoint, details, payload);
  }

  return {
    id: id as string,
    status: status as string,
    ...(name !== undefined ? { name } : {}),
    ...(hostUid !== undefined ? { hostUid } : {}),
    ...(participantCount !== undefined ? { participantCount } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(isLive !== undefined ? { isLive } : {}),
  };
}

function parseRoomDetailContract(endpoint: string, payload: unknown): RoomDetailContract {
  const base = parseRoomContract(endpoint, payload);
  const obj = assertObject(endpoint, payload, "room detail");
  const details: string[] = [];

  const chatRaw = obj.chat;
  if (chatRaw !== undefined) {
    if (typeof chatRaw !== "object" || chatRaw === null || Array.isArray(chatRaw)) {
      details.push("chat must be an object");
    } else {
      const chatObj = chatRaw as UnknownRecord;
      validateOptionalBoolean(chatObj, "enabled", details);
      validateOptionalString(chatObj, "activeSessionId", details, true);
    }
  }

  if (details.length > 0) {
    throwValidation(endpoint, details, payload);
  }

  const chatObj = chatRaw && typeof chatRaw === "object" && !Array.isArray(chatRaw)
    ? (chatRaw as UnknownRecord)
    : undefined;

  return {
    ...base,
    ...(chatObj
      ? {
          chat: {
            ...(typeof chatObj.enabled === "boolean" ? { enabled: chatObj.enabled } : {}),
            ...((chatObj.activeSessionId === null || typeof chatObj.activeSessionId === "string")
              ? { activeSessionId: (chatObj.activeSessionId as string | null | undefined) }
              : {}),
          },
        }
      : {}),
  };
}

function parseChatMessageContract(endpoint: string, payload: unknown): RoomChatContract {
  const details: string[] = [];
  const obj = assertObject(endpoint, payload, "chat message");

  const id = obj.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    details.push("id is required and must be a non-empty string");
  }

  const text = obj.text;
  if (typeof text !== "string") {
    details.push("text is required and must be a string");
  }

  const senderIdentity = validateOptionalString(obj, "senderIdentity", details, true);
  const senderName = validateOptionalString(obj, "senderName", details, true);
  const senderRole = validateOptionalString(obj, "senderRole", details, true);
  const isAgent = validateOptionalBoolean(obj, "isAgent", details);
  const createdAt = validateOptionalString(obj, "createdAt", details, true);

  if (details.length > 0) {
    throwValidation(endpoint, details, payload);
  }

  return {
    id: id as string,
    text: text as string,
    ...(senderIdentity !== undefined ? { senderIdentity } : {}),
    ...(senderName !== undefined ? { senderName } : {}),
    ...(senderRole !== undefined ? { senderRole } : {}),
    ...(isAgent !== undefined ? { isAgent } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
  };
}

export async function apiFetch(path: string): Promise<unknown> {
  const baseUrl = normalizeBaseUrl(STREAMLINE_API_BASE_URL);
  if (!baseUrl) {
    updateDiagnostics({
      configured: false,
      baseUrl,
      lastEndpoint: path,
      lastErrorType: "config",
      lastErrorMessage: "VITE_STREAMLINE_API_BASE_URL is not configured",
      lastValidationDetails: undefined,
      lastStatusCode: undefined,
    });
    markFailure(path, "config", "VITE_STREAMLINE_API_BASE_URL is not configured", {
      validationPassed: null,
      httpStatusCode: undefined,
      responseTimeMs: undefined,
    });
    throw new Error("VITE_STREAMLINE_API_BASE_URL is not configured");
  }

  const requestUrl = `${baseUrl}${path}`;
  const controller = new AbortController();
  const start = Date.now();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    const duration = Date.now() - start;

    if (import.meta.env.DEV) {
      console.debug("[streamlineApi] GET", requestUrl, `${duration}ms`);
    }

    if (!response.ok) {
      updateDiagnostics({
        configured: true,
        baseUrl,
        lastEndpoint: path,
        lastUrl: requestUrl,
        lastDurationMs: duration,
        lastStatusCode: response.status,
        lastErrorType: "http",
        lastErrorMessage: `HTTP ${response.status} ${response.statusText}`,
        lastValidationDetails: undefined,
      });
      markFailure(path, response.status === 401 || response.status === 403 ? "auth" : "http", `HTTP ${response.status} ${response.statusText}`, {
        httpStatusCode: response.status,
        responseTimeMs: duration,
        validationPassed: null,
      });

      if (import.meta.env.DEV) {
        console.error("[streamlineApi] Request failed", {
          url: requestUrl,
          status: response.status,
          statusText: response.statusText,
          durationMs: duration,
        });
      }
      throw new Error(`StreamLine API request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    updateDiagnostics({
      configured: true,
      baseUrl,
      lastEndpoint: path,
      lastUrl: requestUrl,
      lastDurationMs: duration,
      lastStatusCode: response.status,
      lastErrorType: undefined,
      lastErrorMessage: undefined,
      lastValidationDetails: undefined,
    });
    markSuccess(path, response.status, duration);

    if (!text) return null;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("StreamLine API returned invalid JSON");
    }
  } catch (error) {
    const duration = Date.now() - start;
    if (import.meta.env.DEV) {
      console.error("[streamlineApi] Network error", {
        url: requestUrl,
        durationMs: duration,
        error,
      });
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      updateDiagnostics({
        configured: true,
        baseUrl,
        lastEndpoint: path,
        lastUrl: requestUrl,
        lastDurationMs: duration,
        lastErrorType: "timeout",
        lastErrorMessage: `StreamLine API request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        lastValidationDetails: undefined,
      });
      markFailure(path, "timeout", `StreamLine API request timed out after ${REQUEST_TIMEOUT_MS}ms`, {
        responseTimeMs: duration,
      });
      throw new Error(`StreamLine API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    if (!isStreamlineValidationError(error)) {
      updateDiagnostics({
        configured: true,
        baseUrl,
        lastEndpoint: path,
        lastUrl: requestUrl,
        lastDurationMs: duration,
        lastErrorType: "network",
        lastErrorMessage: error instanceof Error ? error.message : "StreamLine API request failed",
        lastValidationDetails: undefined,
      });
      markFailure(path, "network", error instanceof Error ? error.message : "StreamLine API request failed", {
        responseTimeMs: duration,
      });
    }

    throw error instanceof Error ? error : new Error("StreamLine API request failed");
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchSupportStatus(): Promise<StreamlineSupportStatus> {
  const endpoint = "GET /api/horizon/bot/support/status";
  const payload = await apiFetch("/api/horizon/bot/support/status");
  const statusObj = assertObject(endpoint, payload);
  const details: string[] = [];

  if (typeof statusObj.ok !== "boolean") {
    details.push("ok is required and must be a boolean");
  }

  const timestamp = validateOptionalString(statusObj, "timestamp", details);

  if (statusObj.capabilities !== undefined) {
    if (typeof statusObj.capabilities !== "object" || statusObj.capabilities === null || Array.isArray(statusObj.capabilities)) {
      details.push("capabilities must be an object");
    }
  }

  if (details.length > 0) {
    throwValidation(endpoint, details, payload);
  }

  setValidationCheck("support-status", endpoint, true, []);
  upsertEndpointCheck(endpoint, { validationPassed: true });

  return {
    connected: statusObj.ok as boolean,
    status: (statusObj.ok as boolean) ? "healthy" : "down",
    checkedAt: timestamp ?? new Date().toISOString(),
  };
}

export async function fetchRooms(): Promise<Room[]> {
  const endpoint = "GET /api/horizon/bot/support/rooms";
  const payload = await apiFetch("/api/horizon/bot/support/rooms");
  const rows = asArray(payload);

  if (!Array.isArray(payload)) {
    throwValidation(endpoint, ["response must be an array of room items"], payload);
  }

  const mapped = rows.map((row) => {
    const contract = parseRoomContract(endpoint, row);
    const statusErrors: string[] = [];
    const status = validateRoomStatus(endpoint, contract.status, statusErrors);
    if (statusErrors.length > 0) {
      throwValidation(endpoint, statusErrors, row);
    }

    const roomDetails: StreamlineRoomDetails = {
      id: contract.id,
      name: contract.name ?? `Room ${contract.id}`,
      type: "meeting",
      status,
      participants: contract.participantCount ?? 0,
      maxParticipants: 0,
      createdAt: contract.createdAt ?? new Date().toISOString(),
      lastActivityAt: contract.updatedAt ?? new Date().toISOString(),
      broadcastActive: contract.isLive ?? false,
    };
    return roomDetails;
  });

  setValidationCheck("rooms", endpoint, true, []);
  upsertEndpointCheck(endpoint, { validationPassed: true });
  return mapped;
}

export async function fetchRoomDetails(roomId: string): Promise<StreamlineRoomDetails> {
  const endpoint = "GET /api/horizon/bot/support/rooms/:roomId";
  const payload = await apiFetch(`/api/horizon/bot/support/rooms/${encodeURIComponent(roomId)}`);
  const detail = parseRoomDetailContract(endpoint, payload);
  const statusErrors: string[] = [];
  const mappedStatus = validateRoomStatus(endpoint, detail.status, statusErrors);

  if (statusErrors.length > 0) {
    throwValidation(endpoint, statusErrors, payload);
  }

  setValidationCheck("room-detail", endpoint, true, []);
  upsertEndpointCheck(endpoint, { validationPassed: true });

  return {
    id: detail.id,
    name: detail.name ?? `Room ${detail.id}`,
    type: "meeting",
    status: mappedStatus,
    participants: detail.participantCount ?? 0,
    maxParticipants: 0,
    createdAt: detail.createdAt ?? new Date().toISOString(),
    lastActivityAt: detail.updatedAt ?? new Date().toISOString(),
    broadcastActive: detail.isLive ?? false,
  };
}

export async function fetchRoomChat(roomId: string): Promise<StreamlineRoomChatMessage[]> {
  const endpoint = "GET /api/horizon/bot/support/rooms/:roomId/chat";
  const payload = await apiFetch(`/api/horizon/bot/support/rooms/${encodeURIComponent(roomId)}/chat`);

  if (!Array.isArray(payload)) {
    throwValidation(endpoint, ["response must be an array of chat messages"], payload);
  }

  const messages = payload.map((message) => {
    const item = parseChatMessageContract(endpoint, message);
    return {
      id: item.id,
      roomId,
      authorName: item.senderName ?? item.senderIdentity ?? "Unknown",
      message: item.text,
      createdAt: item.createdAt ?? new Date().toISOString(),
    };
  });

  setValidationCheck("room-chat", endpoint, true, []);
  upsertEndpointCheck(endpoint, { validationPassed: true });
  return messages;
}
