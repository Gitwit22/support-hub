import type { Room, RoomStatus, ServiceStatus } from "@/lib/types/admin";

const STREAMLINE_API_BASE_URL = import.meta.env.VITE_STREAMLINE_API_BASE_URL;
const SUPPORT_DATA_SOURCE = import.meta.env.VITE_SUPPORT_DATA_SOURCE;
const REQUEST_TIMEOUT_MS = 10_000;

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
      throw new Error(`StreamLine API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
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

  return rows.map((row) => {
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

  return payload.map((message) => {
    const item = parseChatMessageContract(endpoint, message);
    return {
      id: item.id,
      roomId,
      authorName: item.senderName ?? item.senderIdentity ?? "Unknown",
      message: item.text,
      createdAt: item.createdAt ?? new Date().toISOString(),
    };
  });
}
