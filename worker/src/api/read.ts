// Dashboard read APIs (Access-protected) plus the incident resolve action.

import type { Identity } from "../auth/access";
import { checkState, deriveEnvironmentStatus, type CheckSnapshot } from "../health/status";
import { HttpError, intParam, isoParam, json, nowIso } from "../http";
import { ENVIRONMENTS } from "../ingest/contract";
import { serializeHealthCheck } from "./registry";

type Row = Record<string, unknown>;

function serializeIncident(row: Row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    environmentId: row.environment_id,
    environment: row.environment,
    fingerprint: row.fingerprint,
    title: row.title,
    service: row.service,
    component: row.component,
    errorCode: row.error_code,
    severity: row.severity,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: row.occurrence_count,
    lastMessage: row.last_message,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

function serializeEvent(row: Row) {
  return {
    id: row.id,
    eventId: row.event_id,
    applicationId: row.application_id,
    environmentId: row.environment_id,
    schemaVersion: row.schema_version,
    type: row.type,
    severity: row.severity,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    appVersion: row.app_version,
    service: row.service,
    component: row.component,
    errorCode: row.error_code,
    message: row.message,
    context: typeof row.context_json === "string" ? JSON.parse(row.context_json) : null,
  };
}

function environmentFilter(value: string | null): string | undefined {
  if (value === null || value === "") return undefined;
  if (!(ENVIRONMENTS as readonly string[]).includes(value)) {
    throw new HttpError(400, "INVALID_QUERY", `environment must be one of ${ENVIRONMENTS.join(", ")}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Applications with live status
// ---------------------------------------------------------------------------

async function loadApplications(db: D1Database, applicationId?: string) {
  const where = applicationId ? "WHERE a.id = ?" : "";
  const binds = applicationId ? [applicationId] : [];
  const [apps, environments, checks, incidentCounts] = await db.batch<Row>([
    db.prepare(`SELECT a.* FROM applications a ${where} ORDER BY a.name`).bind(...binds),
    db.prepare(`SELECT e.* FROM application_environments e JOIN applications a ON a.id = e.application_id ${where}`).bind(...binds),
    db
      .prepare(
        `SELECT c.id, c.environment_id, c.name, c.interval_seconds,
                r.status AS last_status, r.checked_at AS last_checked_at, r.latency_ms AS last_latency_ms,
                r.error_message AS last_error_message
           FROM health_checks c
           JOIN application_environments e ON e.id = c.environment_id
           JOIN applications a ON a.id = e.application_id
           LEFT JOIN health_results r ON r.id = (
             SELECT r2.id FROM health_results r2 WHERE r2.health_check_id = c.id ORDER BY r2.checked_at DESC LIMIT 1
           )
          WHERE c.enabled = 1 ${applicationId ? "AND a.id = ?" : ""}`,
      )
      .bind(...binds),
    db
      .prepare(
        `SELECT i.environment_id, COUNT(*) AS open_count,
                SUM(CASE WHEN i.severity = 'critical' THEN 1 ELSE 0 END) AS critical_count
           FROM incidents i
          WHERE i.status = 'open' ${applicationId ? "AND i.application_id = ?" : ""}
          GROUP BY i.environment_id`,
      )
      .bind(...binds),
  ]);

  const now = Date.now();
  return apps.results.map((app) => ({
    id: app.id,
    name: app.name,
    description: app.description,
    createdAt: app.created_at,
    environments: environments.results
      .filter((env) => env.application_id === app.id)
      .map((env) => {
        const envChecks = checks.results.filter((check) => check.environment_id === env.id);
        const snapshots: CheckSnapshot[] = envChecks.map((check) => ({
          id: check.id as string,
          name: check.name as string,
          intervalSeconds: check.interval_seconds as number,
          lastStatus: (check.last_status as CheckSnapshot["lastStatus"]) ?? null,
          lastCheckedAt: (check.last_checked_at as string) ?? null,
        }));
        const counts = incidentCounts.results.find((row) => row.environment_id === env.id);
        const derived = deriveEnvironmentStatus(snapshots, Number(counts?.critical_count ?? 0), now);
        return {
          id: env.id,
          environment: env.environment,
          baseUrl: env.base_url,
          status: derived.status,
          statusReasons: derived.reasons,
          openIncidentCount: Number(counts?.open_count ?? 0),
          checks: envChecks.map((check, index) => ({
            id: check.id,
            name: check.name,
            state: checkState(snapshots[index], now),
            lastCheckedAt: check.last_checked_at ?? null,
            lastLatencyMs: check.last_latency_ms ?? null,
            lastErrorMessage: check.last_error_message ?? null,
          })),
        };
      }),
  }));
}

export async function listApplications(db: D1Database): Promise<Response> {
  return json({ applications: await loadApplications(db), generatedAt: nowIso() });
}

export async function getApplication(db: D1Database, applicationId: string): Promise<Response> {
  const [application] = await loadApplications(db, applicationId);
  if (!application) throw new HttpError(404, "NOT_FOUND", "Application not found");
  return json({ application, generatedAt: nowIso() });
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export async function listIncidents(db: D1Database, url: URL): Promise<Response> {
  const status = url.searchParams.get("status") ?? "open";
  if (!["open", "resolved", "all"].includes(status)) {
    throw new HttpError(400, "INVALID_QUERY", "status must be open, resolved or all");
  }
  const applicationId = url.searchParams.get("applicationId") || undefined;
  const environment = environmentFilter(url.searchParams.get("environment"));
  const before = isoParam(url.searchParams.get("before"), "before");
  const limit = intParam(url.searchParams.get("limit"), 50, 1, 200);

  const conditions: string[] = [];
  const binds: unknown[] = [];
  if (status !== "all") {
    conditions.push("i.status = ?");
    binds.push(status);
  }
  if (applicationId) {
    conditions.push("i.application_id = ?");
    binds.push(applicationId);
  }
  if (environment) {
    conditions.push("e.environment = ?");
    binds.push(environment);
  }
  if (before) {
    conditions.push("i.last_seen_at < ?");
    binds.push(before);
  }
  const { results } = await db
    .prepare(
      `SELECT i.*, e.environment FROM incidents i
         JOIN application_environments e ON e.id = i.environment_id
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        ORDER BY i.last_seen_at DESC
        LIMIT ?`,
    )
    .bind(...binds, limit)
    .all<Row>();
  const incidents = results.map(serializeIncident);
  return json({
    incidents,
    nextBefore: incidents.length === limit ? incidents[incidents.length - 1].lastSeenAt : null,
  });
}

export async function getIncident(db: D1Database, incidentId: string, url: URL): Promise<Response> {
  const eventLimit = intParam(url.searchParams.get("eventLimit"), 50, 1, 200);
  const [incidentRows, eventRows] = await db.batch<Row>([
    db
      .prepare(`SELECT i.*, e.environment FROM incidents i JOIN application_environments e ON e.id = i.environment_id WHERE i.id = ?`)
      .bind(incidentId),
    db
      .prepare(
        `SELECT ev.* FROM incident_events ie JOIN events ev ON ev.id = ie.event_id
          WHERE ie.incident_id = ? ORDER BY ev.occurred_at DESC LIMIT ?`,
      )
      .bind(incidentId, eventLimit),
  ]);
  const incident = incidentRows.results[0];
  if (!incident) throw new HttpError(404, "NOT_FOUND", "Incident not found");
  return json({ incident: serializeIncident(incident), recentEvents: eventRows.results.map(serializeEvent) });
}

/**
 * open -> resolved is the only transition. Resolving twice is a no-op that
 * reports the existing resolution. A later event with the same fingerprint
 * opens a new incident (a regression), it does not reopen this one.
 */
export async function resolveIncident(db: D1Database, incidentId: string, identity: Identity): Promise<Response> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE incidents SET status = 'resolved', resolved_at = ?, resolved_by = ?, updated_at = ?
        WHERE id = ? AND status = 'open'`,
    )
    .bind(now, identity.subject, now, incidentId)
    .run();
  const row = await db
    .prepare(`SELECT i.*, e.environment FROM incidents i JOIN application_environments e ON e.id = i.environment_id WHERE i.id = ?`)
    .bind(incidentId)
    .first<Row>();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Incident not found");
  return json({ incident: serializeIncident(row), alreadyResolved: result.meta.changes === 0 });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function listEvents(db: D1Database, url: URL): Promise<Response> {
  const applicationId = url.searchParams.get("applicationId") || undefined;
  const environment = environmentFilter(url.searchParams.get("environment"));
  const type = url.searchParams.get("type") || undefined;
  if (type && !["error", "warning", "info"].includes(type)) {
    throw new HttpError(400, "INVALID_QUERY", "type must be error, warning or info");
  }
  const before = isoParam(url.searchParams.get("before"), "before");
  const limit = intParam(url.searchParams.get("limit"), 50, 1, 200);

  const conditions: string[] = [];
  const binds: unknown[] = [];
  if (applicationId) {
    conditions.push("ev.application_id = ?");
    binds.push(applicationId);
  }
  if (environment) {
    conditions.push("e.environment = ?");
    binds.push(environment);
  }
  if (type) {
    conditions.push("ev.type = ?");
    binds.push(type);
  }
  if (before) {
    conditions.push("ev.received_at < ?");
    binds.push(before);
  }
  const { results } = await db
    .prepare(
      `SELECT ev.* FROM events ev JOIN application_environments e ON e.id = ev.environment_id
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        ORDER BY ev.received_at DESC LIMIT ?`,
    )
    .bind(...binds, limit)
    .all<Row>();
  const events = results.map(serializeEvent);
  return json({ events, nextBefore: events.length === limit ? events[events.length - 1].receivedAt : null });
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

export async function listHealthChecks(db: D1Database, environmentId: string): Promise<Response> {
  const env = await db.prepare(`SELECT id FROM application_environments WHERE id = ?`).bind(environmentId).first();
  if (!env) throw new HttpError(404, "NOT_FOUND", "Environment not found");
  const { results } = await db
    .prepare(`SELECT * FROM health_checks WHERE environment_id = ? ORDER BY name`)
    .bind(environmentId)
    .all<Row>();
  return json({ healthChecks: results.map(serializeHealthCheck) });
}

export async function listHealthResults(db: D1Database, healthCheckId: string, url: URL): Promise<Response> {
  const limit = intParam(url.searchParams.get("limit"), 100, 1, 1000);
  const [checkRows, resultRows] = await db.batch<Row>([
    db.prepare(`SELECT * FROM health_checks WHERE id = ?`).bind(healthCheckId),
    db
      .prepare(`SELECT * FROM health_results WHERE health_check_id = ? ORDER BY checked_at DESC LIMIT ?`)
      .bind(healthCheckId, limit),
  ]);
  const check = checkRows.results[0];
  if (!check) throw new HttpError(404, "NOT_FOUND", "Health check not found");
  return json({
    healthCheck: serializeHealthCheck(check),
    results: resultRows.results.map((row) => ({
      id: row.id,
      status: row.status,
      httpStatus: row.http_status,
      latencyMs: row.latency_ms,
      errorType: row.error_type,
      errorMessage: row.error_message,
      checkedAt: row.checked_at,
    })),
  });
}
