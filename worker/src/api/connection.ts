// Connection verification for one application environment: "is this program
// really linked?" Two independent proofs, both required for "connected":
//   1. health — every enabled check answers (up or degraded)
//   2. telemetry — the app has delivered at least one event with a key that is
//      still active (proves SUPPORT_HUB_URL + key are set and reachable from it)

import type { Env } from "../env";
import { MAX_CHECKS_PER_TICK, runAndRecord, type HealthCheckRow } from "../health/runner";
import { HttpError, json, nowIso } from "../http";

type Row = Record<string, unknown>;

export type ConnectionVerdict = "connected" | "partial" | "not_connected";

interface CheckView {
  id: string;
  name: string;
  url: string;
  status: "up" | "degraded" | "down" | "not_run";
  httpStatus: number | null;
  latencyMs: number | null;
  errorType: string | null;
  errorMessage: string | null;
  checkedAt: string | null;
}

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 90) return `${seconds}s ago`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 36 * 3600) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export async function connectionReport(env: Env, environmentId: string, runChecks: boolean): Promise<Response> {
  const environment = await env.DB.prepare(
    `SELECT e.id, e.environment, e.application_id, e.base_url, a.name AS application_name
       FROM application_environments e JOIN applications a ON a.id = e.application_id
      WHERE e.id = ?`,
  )
    .bind(environmentId)
    .first<Row>();
  if (!environment) throw new HttpError(404, "NOT_FOUND", "Environment not found");

  const { results: checkRows } = await env.DB.prepare(
    `SELECT id, environment_id, name, url, expected_status, timeout_ms, interval_seconds,
            degraded_latency_ms, auth_secret_name, last_run_at
       FROM health_checks WHERE environment_id = ? AND enabled = 1 ORDER BY name`,
  )
    .bind(environmentId)
    .all<HealthCheckRow>();

  let checks: CheckView[];
  if (runChecks) {
    const outcomes = await runAndRecord(env, checkRows.slice(0, MAX_CHECKS_PER_TICK));
    checks = outcomes.map(({ check, result, checkedAt }) => ({
      id: check.id,
      name: check.name,
      url: check.url,
      status: result.status,
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
      checkedAt,
    }));
  } else {
    const { results: latest } = await env.DB.prepare(
      `SELECT c.id AS check_id, r.status, r.http_status, r.latency_ms, r.error_type, r.error_message, r.checked_at
         FROM health_checks c
         LEFT JOIN health_results r ON r.id = (
           SELECT r2.id FROM health_results r2 WHERE r2.health_check_id = c.id ORDER BY r2.checked_at DESC LIMIT 1
         )
        WHERE c.environment_id = ? AND c.enabled = 1`,
    )
      .bind(environmentId)
      .all<Row>();
    checks = checkRows.map((check) => {
      const row = latest.find((r) => r.check_id === check.id);
      return {
        id: check.id,
        name: check.name,
        url: check.url,
        status: (row?.status as CheckView["status"] | undefined) ?? "not_run",
        httpStatus: (row?.http_status as number) ?? null,
        latencyMs: (row?.latency_ms as number) ?? null,
        errorType: (row?.error_type as string) ?? null,
        errorMessage: (row?.error_message as string) ?? null,
        checkedAt: (row?.checked_at as string) ?? null,
      };
    });
  }

  const [keys, lastEvent] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT COUNT(*) AS active, MAX(last_used_at) AS last_used_at
         FROM telemetry_keys WHERE environment_id = ? AND revoked_at IS NULL`,
    ).bind(environmentId),
    // Only events delivered with a key that is still active prove the current setup works.
    env.DB.prepare(
      `SELECT e.received_at, e.type, e.component, e.error_code, e.app_version
         FROM events e JOIN telemetry_keys k ON k.id = e.telemetry_key_id
        WHERE e.environment_id = ? AND k.revoked_at IS NULL
        ORDER BY e.received_at DESC LIMIT 1`,
    ).bind(environmentId),
  ]);
  const activeKeys = Number(keys.results[0]?.active ?? 0);
  const event = lastEvent.results[0];

  const now = Date.now();
  const passing = checks.filter((c) => c.status === "up" || c.status === "degraded");
  const failing = checks.filter((c) => c.status === "down");
  const notRun = checks.filter((c) => c.status === "not_run");
  const healthOk = checks.length > 0 && passing.length === checks.length;
  const healthDetail = !checks.length
    ? "No enabled health checks"
    : healthOk
      ? `${passing.length}/${checks.length} checks passing`
      : [
          failing.length ? `${failing.length} failing: ${failing.map((c) => c.name).join(", ")}` : "",
          notRun.length ? `${notRun.length} not run yet` : "",
        ]
          .filter(Boolean)
          .join(" · ");

  const telemetryOk = Boolean(event);
  const telemetryDetail = event
    ? `Last event ${ago(event.received_at as string, now)}: ${event.type} ${event.error_code ?? ""} in ${event.component}${
        event.app_version ? ` (version ${event.app_version})` : ""
      }`.replace(/\s+/g, " ")
    : activeKeys === 0
      ? "No active telemetry key: issue one and add it to the app"
      : "No events received yet: set SUPPORT_HUB_URL and SUPPORT_HUB_TELEMETRY_KEY on the app's server and restart it";

  const verdict: ConnectionVerdict = healthOk && telemetryOk ? "connected" : healthOk || telemetryOk ? "partial" : "not_connected";

  return json({
    environmentId,
    applicationId: environment.application_id,
    applicationName: environment.application_name,
    environment: environment.environment,
    checkedAt: nowIso(),
    ranChecks: runChecks,
    verdict,
    steps: [
      { id: "health", ok: healthOk, detail: healthDetail },
      { id: "telemetry", ok: telemetryOk, detail: telemetryDetail },
    ],
    healthChecks: checks,
    telemetry: {
      activeKeys,
      lastKeyUsedAt: keys.results[0]?.last_used_at ?? null,
      lastEventAt: event?.received_at ?? null,
    },
  });
}
