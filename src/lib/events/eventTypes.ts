// ---------------------------------------------------------------------------
// Streamline canonical event types, payload interface, and factory.
// ---------------------------------------------------------------------------

// Chat events
export const CHAT_MESSAGE_CREATED = "chat.message.created" as const;
export const CHAT_MESSAGE_UPDATED = "chat.message.updated" as const;
export const CHAT_MESSAGE_DELETED = "chat.message.deleted" as const;

// Voice / streaming events
export const VOICE_STREAM_STARTED = "voice.stream.started" as const;
export const VOICE_STREAM_ENDED = "voice.stream.ended" as const;
export const VOICE_PARTICIPANT_MUTED = "voice.participant.muted" as const;
export const VOICE_PARTICIPANT_UNMUTED = "voice.participant.unmuted" as const;

// Support / ticket events
export const SUPPORT_TICKET_CREATED = "support.ticket.created" as const;
export const SUPPORT_TICKET_UPDATED = "support.ticket.updated" as const;
export const SUPPORT_TICKET_CLOSED = "support.ticket.closed" as const;
export const SUPPORT_TICKET_ASSIGNED = "support.ticket.assigned" as const;

// Room events
export const ROOM_CREATED = "room.created" as const;
export const ROOM_STARTED = "room.started" as const;
export const ROOM_ENDED = "room.ended" as const;
export const ROOM_PARTICIPANT_JOINED = "room.participant_joined" as const;
export const ROOM_PARTICIPANT_LEFT = "room.participant_left" as const;

// Monitoring events
export const MONITORING_SERVICE_DEGRADED = "monitoring.service.degraded" as const;
export const MONITORING_SERVICE_RESTORED = "monitoring.service.restored" as const;
export const MONITORING_HEALTH_CHECK = "monitoring.health_check" as const;

// Alert events
export const ALERT_TRIGGERED = "alert.triggered" as const;
export const ALERT_ACKNOWLEDGED = "alert.acknowledged" as const;
export const ALERT_RESOLVED = "alert.resolved" as const;

/**
 * Union of all 22 canonical Streamline event names.
 */
export type StreamlineEventName =
  | typeof CHAT_MESSAGE_CREATED
  | typeof CHAT_MESSAGE_UPDATED
  | typeof CHAT_MESSAGE_DELETED
  | typeof VOICE_STREAM_STARTED
  | typeof VOICE_STREAM_ENDED
  | typeof VOICE_PARTICIPANT_MUTED
  | typeof VOICE_PARTICIPANT_UNMUTED
  | typeof SUPPORT_TICKET_CREATED
  | typeof SUPPORT_TICKET_UPDATED
  | typeof SUPPORT_TICKET_CLOSED
  | typeof SUPPORT_TICKET_ASSIGNED
  | typeof ROOM_CREATED
  | typeof ROOM_STARTED
  | typeof ROOM_ENDED
  | typeof ROOM_PARTICIPANT_JOINED
  | typeof ROOM_PARTICIPANT_LEFT
  | typeof MONITORING_SERVICE_DEGRADED
  | typeof MONITORING_SERVICE_RESTORED
  | typeof MONITORING_HEALTH_CHECK
  | typeof ALERT_TRIGGERED
  | typeof ALERT_ACKNOWLEDGED
  | typeof ALERT_RESOLVED;

/**
 * Convenience array of all event names (useful for subscriptions & validation).
 */
export const ALL_EVENT_NAMES: readonly StreamlineEventName[] = [
  CHAT_MESSAGE_CREATED,
  CHAT_MESSAGE_UPDATED,
  CHAT_MESSAGE_DELETED,
  VOICE_STREAM_STARTED,
  VOICE_STREAM_ENDED,
  VOICE_PARTICIPANT_MUTED,
  VOICE_PARTICIPANT_UNMUTED,
  SUPPORT_TICKET_CREATED,
  SUPPORT_TICKET_UPDATED,
  SUPPORT_TICKET_CLOSED,
  SUPPORT_TICKET_ASSIGNED,
  ROOM_CREATED,
  ROOM_STARTED,
  ROOM_ENDED,
  ROOM_PARTICIPANT_JOINED,
  ROOM_PARTICIPANT_LEFT,
  MONITORING_SERVICE_DEGRADED,
  MONITORING_SERVICE_RESTORED,
  MONITORING_HEALTH_CHECK,
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  ALERT_RESOLVED,
] as const;

/**
 * Standard payload envelope for every Streamline event.
 */
export interface StreamlineEventPayload<T = Record<string, unknown>> {
  /** Unique event ID (UUID v4). */
  id: string;
  /** Canonical event name. */
  event: StreamlineEventName;
  /** ISO-8601 timestamp of when the event was created. */
  timestamp: string;
  /** Originating service / module (e.g. "roomChat", "webhook"). */
  source: string;
  /** Domain-specific data for the event. */
  data: T;
}

let _counter = 0;

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  _counter += 1;
  return `evt-${Date.now()}-${_counter}`;
}

/**
 * Factory – creates a well-formed event payload with auto-generated id and
 * timestamp.
 */
export function createEventPayload<T = Record<string, unknown>>(
  event: StreamlineEventName,
  source: string,
  data: T,
): StreamlineEventPayload<T> {
  return {
    id: generateId(),
    event,
    timestamp: new Date().toISOString(),
    source,
    data,
  };
}
