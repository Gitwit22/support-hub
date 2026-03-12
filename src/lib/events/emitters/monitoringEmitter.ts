// ---------------------------------------------------------------------------
// Monitoring domain emitter – convenience functions for system health events.
// ---------------------------------------------------------------------------

import { getEventBus } from "../eventBus";
import {
  createEventPayload,
  MONITORING_SERVICE_DEGRADED,
  MONITORING_SERVICE_RESTORED,
  MONITORING_HEALTH_CHECK,
} from "../eventTypes";

const SOURCE = "monitoringEmitter";

export function emitServiceDegraded(data: {
  service: string;
  status: string;
  message: string;
}) {
  getEventBus().emit(createEventPayload(MONITORING_SERVICE_DEGRADED, SOURCE, data));
}

export function emitServiceRestored(data: {
  service: string;
  message: string;
}) {
  getEventBus().emit(createEventPayload(MONITORING_SERVICE_RESTORED, SOURCE, data));
}

export function emitHealthCheck(data: {
  services: Array<{ name: string; status: string; latencyMs?: number }>;
  overallStatus: string;
}) {
  getEventBus().emit(createEventPayload(MONITORING_HEALTH_CHECK, SOURCE, data));
}
