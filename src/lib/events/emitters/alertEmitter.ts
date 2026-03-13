// ---------------------------------------------------------------------------
// Alert domain emitter – convenience functions for alert lifecycle events.
// ---------------------------------------------------------------------------

import { getEventBus } from "../eventBus";
import {
  createEventPayload,
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  ALERT_RESOLVED,
} from "../eventTypes";

const SOURCE = "alertEmitter";

export function emitAlertTriggered(data: {
  alertId: string;
  title: string;
  severity: string;
  service: string;
  message: string;
}) {
  getEventBus().emit(createEventPayload(ALERT_TRIGGERED, SOURCE, data));
}

export function emitAlertAcknowledged(data: {
  alertId: string;
  acknowledgedBy: string;
}) {
  getEventBus().emit(createEventPayload(ALERT_ACKNOWLEDGED, SOURCE, data));
}

export function emitAlertResolved(data: {
  alertId: string;
  resolvedBy: string;
  resolution?: string;
}) {
  getEventBus().emit(createEventPayload(ALERT_RESOLVED, SOURCE, data));
}
