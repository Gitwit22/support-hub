import type { TelemetryPrincipal } from "../auth/telemetryKeys";
import { HttpError, newId, nowIso } from "../http";
import { SEVERITY_RANK, type TelemetryEventV1 } from "./contract";
import { redactMessage, redactRoute } from "./redact";

// Avoid a write on every event just to bump last_used_at.
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

export interface IngestResult {
  duplicate: boolean;
  eventId: string;
  incidentId: string | null;
}

/**
 * Incident identity: application + environment + component + error code.
 * The message is deliberately excluded; messages often embed ids and would
 * split one failure into many incidents.
 */
export function incidentFingerprint(event: TelemetryEventV1): string | null {
  if (event.type !== "error" || !event.error) return null;
  return [event.application.id, event.application.environment, event.source.component, event.error.code].join(":");
}

function buildContext(event: TelemetryEventV1): string | null {
  if (!event.context) return null;
  const context = { ...event.context };
  if (context.route) context.route = redactRoute(context.route);
  return Object.keys(context).length ? JSON.stringify(context) : null;
}

/**
 * Stores one event and folds it into its incident in a single D1 transaction.
 * A retried eventId changes nothing: the event insert is a no-op, and the
 * incident statements only act on the row id generated for this attempt.
 */
export async function ingestEvent(
  db: D1Database,
  principal: TelemetryPrincipal,
  event: TelemetryEventV1,
): Promise<IngestResult> {
  if (event.application.id !== principal.applicationId || event.application.environment !== principal.environment) {
    throw new HttpError(403, "APPLICATION_MISMATCH", "Telemetry key is not valid for this application environment");
  }

  const rowId = newId();
  const receivedAt = nowIso();
  const occurredAt = new Date(event.timestamp).toISOString();
  const fingerprint = incidentFingerprint(event);
  const message = event.error?.message ? redactMessage(event.error.message) : null;

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO events (id, application_id, environment_id, event_id, schema_version, type, severity,
                             occurred_at, received_at, app_version, service, component, error_code, message,
                             context_json, fingerprint, telemetry_key_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (application_id, event_id) DO NOTHING`,
      )
      .bind(
        rowId,
        principal.applicationId,
        principal.environmentId,
        event.eventId,
        event.schemaVersion,
        event.type,
        event.severity,
        occurredAt,
        receivedAt,
        event.application.version ?? null,
        event.source.service,
        event.source.component,
        event.error?.code ?? null,
        message,
        buildContext(event),
        fingerprint,
        principal.keyId,
      ),
  ];

  if (fingerprint) {
    // SELECT ... WHERE e.id = rowId yields no row when the event was a
    // duplicate, so the upsert and link below become no-ops on retries.
    // In DO UPDATE every right-hand column reference reads the pre-update row.
    statements.push(
      db
        .prepare(
          `INSERT INTO incidents (id, application_id, environment_id, fingerprint, title, service, component,
                                  error_code, severity, severity_rank, status, first_seen_at, last_seen_at,
                                  occurrence_count, last_message, created_at, updated_at)
           SELECT ?, e.application_id, e.environment_id, e.fingerprint, ?, e.service, e.component,
                  e.error_code, e.severity, ?, 'open', e.occurred_at, e.occurred_at, 1, e.message, ?, ?
             FROM events e
            WHERE e.id = ?
           ON CONFLICT (environment_id, fingerprint) WHERE status = 'open' DO UPDATE SET
             occurrence_count = occurrence_count + 1,
             first_seen_at = MIN(first_seen_at, excluded.first_seen_at),
             last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
             severity = CASE WHEN excluded.severity_rank > severity_rank THEN excluded.severity ELSE severity END,
             severity_rank = MAX(severity_rank, excluded.severity_rank),
             service = CASE WHEN excluded.last_seen_at >= last_seen_at THEN excluded.service ELSE service END,
             last_message = CASE WHEN excluded.last_seen_at >= last_seen_at THEN excluded.last_message ELSE last_message END,
             updated_at = excluded.updated_at`,
        )
        .bind(
          newId(),
          `${event.error!.code} in ${event.source.component}`,
          SEVERITY_RANK[event.severity],
          receivedAt,
          receivedAt,
          rowId,
        ),
      db
        .prepare(
          `INSERT INTO incident_events (incident_id, event_id, created_at)
           SELECT i.id, e.id, ?
             FROM events e
             JOIN incidents i ON i.environment_id = e.environment_id AND i.fingerprint = e.fingerprint AND i.status = 'open'
            WHERE e.id = ?
           RETURNING incident_id`,
        )
        .bind(receivedAt, rowId),
    );
  }

  const staleBefore = new Date(Date.now() - LAST_USED_RESOLUTION_MS).toISOString();
  if (!principal.lastUsedAt || principal.lastUsedAt < staleBefore) {
    statements.push(
      db
        .prepare(`UPDATE telemetry_keys SET last_used_at = ? WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)`)
        .bind(receivedAt, principal.keyId, staleBefore),
    );
  }

  const results = await db.batch(statements);
  const duplicate = results[0].meta.changes === 0;
  if (duplicate) {
    return { duplicate: true, eventId: event.eventId, incidentId: null };
  }
  const link = fingerprint ? (results[2].results[0] as { incident_id?: string } | undefined) : undefined;
  return { duplicate: false, eventId: event.eventId, incidentId: link?.incident_id ?? null };
}
