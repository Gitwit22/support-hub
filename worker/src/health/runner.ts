// Cron-driven health polling. Every tick runs the enabled checks whose
// interval has elapsed and records one result per check.

import type { Env } from "../env";
import { newId, nowIso } from "../http";

/** Cloudflare caps subrequests per invocation; stay well under it. */
export const MAX_CHECKS_PER_TICK = 40;
const RESULT_RETENTION_DAYS = 30;
// Cron fires on minute boundaries; a little slack keeps a 60s check from
// slipping to every other tick because the previous run finished at :00.4.
const SCHEDULE_SLACK_MS = 5_000;
const SECRET_NAME_PATTERN = /^HC_[A-Z0-9_]{1,60}$/;

export interface HealthCheckRow {
  id: string;
  environment_id: string;
  name: string;
  url: string;
  expected_status: number;
  timeout_ms: number;
  interval_seconds: number;
  degraded_latency_ms: number | null;
  auth_secret_name: string | null;
  last_run_at: string | null;
}

export interface HealthResult {
  status: "up" | "degraded" | "down";
  httpStatus: number | null;
  latencyMs: number | null;
  errorType: "timeout" | "network" | "http_status" | "config" | null;
  errorMessage: string | null;
}

export function isSecretNameAllowed(name: string): boolean {
  return SECRET_NAME_PATTERN.test(name);
}

export function isDue(check: Pick<HealthCheckRow, "last_run_at" | "interval_seconds">, now: number): boolean {
  if (!check.last_run_at) return true;
  return Date.parse(check.last_run_at) + check.interval_seconds * 1000 - SCHEDULE_SLACK_MS <= now;
}

export async function runHealthCheck(check: HealthCheckRow, env: Env): Promise<HealthResult> {
  const headers: Record<string, string> = { "User-Agent": "support-hub-health/1", Accept: "application/json" };
  if (check.auth_secret_name) {
    const secret = isSecretNameAllowed(check.auth_secret_name) ? env[check.auth_secret_name as `HC_${string}`] : undefined;
    if (!secret) {
      // A missing secret must read as a failure, never as a skipped check.
      return {
        status: "down",
        httpStatus: null,
        latencyMs: null,
        errorType: "config",
        errorMessage: `Secret ${check.auth_secret_name} is not configured`,
      };
    }
    headers.Authorization = `Bearer ${secret}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), check.timeout_ms);
  const started = Date.now();
  try {
    // Health endpoints should answer directly; a redirect counts as a status mismatch.
    const response = await fetch(check.url, { method: "GET", headers, redirect: "manual", signal: controller.signal });
    const latencyMs = Date.now() - started;
    // Response bodies are not stored (they may carry application data); just release them.
    await response.body?.cancel();
    if (response.status !== check.expected_status) {
      return {
        status: "down",
        httpStatus: response.status,
        latencyMs,
        errorType: "http_status",
        errorMessage: `Expected HTTP ${check.expected_status}, got ${response.status}`,
      };
    }
    const slow = check.degraded_latency_ms !== null && latencyMs > check.degraded_latency_ms;
    return {
      status: slow ? "degraded" : "up",
      httpStatus: response.status,
      latencyMs,
      errorType: null,
      errorMessage: slow ? `Latency ${latencyMs}ms exceeds ${check.degraded_latency_ms}ms` : null,
    };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      status: "down",
      httpStatus: null,
      latencyMs: timedOut ? check.timeout_ms : null,
      errorType: timedOut ? "timeout" : "network",
      errorMessage: timedOut
        ? `No response within ${check.timeout_ms}ms`
        : `Request failed: ${(error as Error).message ?? "network error"}`.slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runDueHealthChecks(env: Env, now = Date.now()): Promise<{ ran: number; skipped: number }> {
  const { results: checks } = await env.DB.prepare(
    `SELECT id, environment_id, name, url, expected_status, timeout_ms, interval_seconds,
            degraded_latency_ms, auth_secret_name, last_run_at
       FROM health_checks
      WHERE enabled = 1
      ORDER BY last_run_at IS NOT NULL, last_run_at ASC`,
  ).all<HealthCheckRow>();

  const due = checks.filter((check) => isDue(check, now));
  const batch = due.slice(0, MAX_CHECKS_PER_TICK);
  if (due.length > batch.length) {
    console.warn(JSON.stringify({ msg: "health_checks_deferred", due: due.length, ran: batch.length }));
  }

  const outcomes = await Promise.all(batch.map(async (check) => ({ check, result: await runHealthCheck(check, env) })));
  if (outcomes.length) {
    const checkedAt = nowIso();
    await env.DB.batch(
      outcomes.flatMap(({ check, result }) => [
        env.DB.prepare(
          `INSERT INTO health_results (id, health_check_id, status, http_status, latency_ms, error_type, error_message, checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(newId(), check.id, result.status, result.httpStatus, result.latencyMs, result.errorType, result.errorMessage, checkedAt),
        env.DB.prepare(`UPDATE health_checks SET last_run_at = ? WHERE id = ?`).bind(checkedAt, check.id),
      ]),
    );
  }
  return { ran: outcomes.length, skipped: due.length - batch.length };
}

export async function pruneHealthResults(db: D1Database, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - RESULT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare(`DELETE FROM health_results WHERE checked_at < ?`).bind(cutoff).run();
  return result.meta.changes;
}
