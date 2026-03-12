// ---------------------------------------------------------------------------
// Barrel export – Streamline event system
// ---------------------------------------------------------------------------

// Core
export {
  type StreamlineEventName,
  type StreamlineEventPayload,
  createEventPayload,
  ALL_EVENT_NAMES,
  // Chat events
  CHAT_MESSAGE_CREATED,
  CHAT_MESSAGE_UPDATED,
  CHAT_MESSAGE_DELETED,
  // Voice events
  VOICE_STREAM_STARTED,
  VOICE_STREAM_ENDED,
  VOICE_PARTICIPANT_MUTED,
  VOICE_PARTICIPANT_UNMUTED,
  // Support events
  SUPPORT_TICKET_CREATED,
  SUPPORT_TICKET_UPDATED,
  SUPPORT_TICKET_CLOSED,
  SUPPORT_TICKET_ASSIGNED,
  // Room events
  ROOM_CREATED,
  ROOM_STARTED,
  ROOM_ENDED,
  ROOM_PARTICIPANT_JOINED,
  ROOM_PARTICIPANT_LEFT,
  // Monitoring events
  MONITORING_SERVICE_DEGRADED,
  MONITORING_SERVICE_RESTORED,
  MONITORING_HEALTH_CHECK,
  // Alert events
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  ALERT_RESOLVED,
} from "./eventTypes";

export { StreamlineEventBus, getEventBus, resetEventBus } from "./eventBus";

export {
  WebhookDispatcher,
  getWebhookDispatcher,
  resetWebhookDispatcher,
  type WebhookDispatcherConfig,
  type WebhookDelivery,
  type DeliveryStatus,
} from "./webhookDispatcher";

// Domain emitters (re-export barrel)
export * from "./emitters";
