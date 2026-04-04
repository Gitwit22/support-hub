// ---------------------------------------------------------------------------
// Beta Testing – shared types for the beta event reporting system.
// ---------------------------------------------------------------------------

export type BetaEventType = "usage" | "error" | "warning" | "critical";
export type BetaSeverity = "info" | "warning" | "error" | "critical";

/** A single beta event record (mirrors the BetaEvent database model). */
export interface BetaEvent {
  id: string;
  systemName: string;
  feature: string;
  eventType: BetaEventType;
  severity: BetaSeverity;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Payload accepted by POST /api/beta/events. */
export interface CreateBetaEventPayload {
  systemName: string;
  feature: string;
  eventType: BetaEventType;
  severity: BetaSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Success response from POST /api/beta/events. */
export interface CreateBetaEventResponse {
  success: true;
  event: BetaEvent;
}

/** Response from GET /api/beta/test. */
export interface BetaTestResponse {
  status: "Beta system active";
}
