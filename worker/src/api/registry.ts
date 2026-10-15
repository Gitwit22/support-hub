// Registry management for the dashboard (Access-protected): applications,
// environments, telemetry keys and health checks.

import { z } from "zod";
import type { Identity } from "../auth/access";
import { generateTelemetryToken, hashToken } from "../auth/telemetryKeys";
import { isSecretNameAllowed, runHealthCheck } from "../health/runner";
import type { Env } from "../env";
import { HttpError, json, newId, nowIso } from "../http";
import { APPLICATION_ID_PATTERN, ENVIRONMENTS } from "../ingest/contract";

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "VALIDATION_FAILED", "Request body is invalid", {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return result.data;
}

function isUniqueViolation(error: unknown): boolean {
  return /UNIQUE constraint failed/i.test((error as Error)?.message ?? "");
}

const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", "must use https");

// ---------------------------------------------------------------------------
// Applications & environments
// ---------------------------------------------------------------------------

const createApplicationSchema = z
  .object({
    id: z.string().regex(APPLICATION_ID_PATTERN, "must be a lowercase slug, e.g. clientflow"),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export async function createApplication(db: D1Database, body: unknown): Promise<Response> {
  const input = parseBody(createApplicationSchema, body);
  const now = nowIso();
  try {
    await db
      .prepare(`INSERT INTO applications (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(input.id, input.name, input.description ?? null, now, now)
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "APPLICATION_EXISTS", `Application ${input.id} already exists`);
    throw error;
  }
  return json({ application: { id: input.id, name: input.name, description: input.description ?? null, createdAt: now } }, 201);
}

const createEnvironmentSchema = z
  .object({
    environment: z.enum(ENVIRONMENTS),
    baseUrl: httpsUrl.optional(),
  })
  .strict();

export async function createEnvironment(db: D1Database, applicationId: string, body: unknown): Promise<Response> {
  const input = parseBody(createEnvironmentSchema, body);
  const app = await db.prepare(`SELECT id FROM applications WHERE id = ?`).bind(applicationId).first();
  if (!app) throw new HttpError(404, "NOT_FOUND", "Application not found");
  const id = newId();
  const now = nowIso();
  try {
    await db
      .prepare(
        `INSERT INTO application_environments (id, application_id, environment, base_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, applicationId, input.environment, input.baseUrl ?? null, now, now)
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "ENVIRONMENT_EXISTS", `${applicationId} already has a ${input.environment} environment`);
    }
    throw error;
  }
  return json(
    { environment: { id, applicationId, environment: input.environment, baseUrl: input.baseUrl ?? null, createdAt: now } },
    201,
  );
}

async function requireEnvironment(db: D1Database, environmentId: string): Promise<void> {
  const row = await db.prepare(`SELECT id FROM application_environments WHERE id = ?`).bind(environmentId).first();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Environment not found");
}

// ---------------------------------------------------------------------------
// Telemetry keys
// ---------------------------------------------------------------------------

const createKeySchema = z.object({ label: z.string().trim().min(1).max(100).optional() }).strict();

export async function createTelemetryKey(
  db: D1Database,
  environmentId: string,
  body: unknown,
  identity: Identity,
): Promise<Response> {
  const input = parseBody(createKeySchema, body ?? {});
  await requireEnvironment(db, environmentId);
  const { keyId, token } = generateTelemetryToken();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO telemetry_keys (id, environment_id, key_hash, label, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(keyId, environmentId, await hashToken(token), input.label ?? null, identity.subject, now)
    .run();
  // The plaintext token is returned exactly once and never stored.
  return json({ key: { id: keyId, environmentId, label: input.label ?? null, createdAt: now }, token }, 201);
}

export async function listTelemetryKeys(db: D1Database, environmentId: string): Promise<Response> {
  await requireEnvironment(db, environmentId);
  const { results } = await db
    .prepare(
      `SELECT id, label, created_by, created_at, last_used_at, revoked_at
         FROM telemetry_keys WHERE environment_id = ? ORDER BY created_at DESC`,
    )
    .bind(environmentId)
    .all<Record<string, string | null>>();
  return json({
    keys: results.map((row) => ({
      id: row.id,
      label: row.label,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    })),
  });
}

export async function revokeTelemetryKey(db: D1Database, keyId: string): Promise<Response> {
  const now = nowIso();
  const result = await db
    .prepare(`UPDATE telemetry_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
    .bind(now, keyId)
    .run();
  if (result.meta.changes === 0) {
    const existing = await db.prepare(`SELECT revoked_at FROM telemetry_keys WHERE id = ?`).bind(keyId).first<{ revoked_at: string }>();
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Telemetry key not found");
    return json({ key: { id: keyId, revokedAt: existing.revoked_at }, alreadyRevoked: true });
  }
  return json({ key: { id: keyId, revokedAt: now }, alreadyRevoked: false });
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

const secretName = z.string().refine(isSecretNameAllowed, "must be a Worker secret name starting with HC_");

const healthCheckFields = {
  name: z.string().trim().min(1).max(64),
  url: httpsUrl,
  expectedStatus: z.number().int().min(100).max(599),
  timeoutMs: z.number().int().min(1000).max(30000),
  intervalSeconds: z.number().int().min(60).max(86400),
  degradedLatencyMs: z.number().int().min(1).max(30000).nullable(),
  authSecretName: secretName.nullable(),
};

const createHealthCheckSchema = z
  .object({
    name: healthCheckFields.name,
    url: healthCheckFields.url,
    expectedStatus: healthCheckFields.expectedStatus.default(200),
    timeoutMs: healthCheckFields.timeoutMs.default(10000),
    intervalSeconds: healthCheckFields.intervalSeconds.default(60),
    degradedLatencyMs: healthCheckFields.degradedLatencyMs.optional(),
    authSecretName: healthCheckFields.authSecretName.optional(),
  })
  .strict();

const updateHealthCheckSchema = z
  .object({ ...healthCheckFields, enabled: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "at least one field is required");

const COLUMN_FOR_FIELD: Record<string, string> = {
  name: "name",
  url: "url",
  expectedStatus: "expected_status",
  timeoutMs: "timeout_ms",
  intervalSeconds: "interval_seconds",
  degradedLatencyMs: "degraded_latency_ms",
  authSecretName: "auth_secret_name",
  enabled: "enabled",
};

export function serializeHealthCheck(row: Record<string, unknown>) {
  return {
    id: row.id,
    environmentId: row.environment_id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    expectedStatus: row.expected_status,
    timeoutMs: row.timeout_ms,
    intervalSeconds: row.interval_seconds,
    degradedLatencyMs: row.degraded_latency_ms,
    authSecretName: row.auth_secret_name,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createHealthCheck(db: D1Database, environmentId: string, body: unknown): Promise<Response> {
  const input = parseBody(createHealthCheckSchema, body);
  await requireEnvironment(db, environmentId);
  const id = newId();
  const now = nowIso();
  try {
    await db
      .prepare(
        `INSERT INTO health_checks (id, environment_id, name, kind, url, expected_status, timeout_ms, interval_seconds,
                                    degraded_latency_ms, auth_secret_name, enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'http', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        environmentId,
        input.name,
        input.url,
        input.expectedStatus,
        input.timeoutMs,
        input.intervalSeconds,
        input.degradedLatencyMs ?? null,
        input.authSecretName ?? null,
        now,
        now,
      )
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "HEALTH_CHECK_EXISTS", `A check named "${input.name}" already exists`);
    throw error;
  }
  const row = await db.prepare(`SELECT * FROM health_checks WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  return json({ healthCheck: serializeHealthCheck(row!) }, 201);
}

export async function updateHealthCheck(db: D1Database, healthCheckId: string, body: unknown): Promise<Response> {
  const input = parseBody(updateHealthCheckSchema, body);
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [field, value] of Object.entries(input)) {
    assignments.push(`${COLUMN_FOR_FIELD[field]} = ?`);
    values.push(field === "enabled" ? (value ? 1 : 0) : value);
  }
  assignments.push("updated_at = ?");
  values.push(nowIso());
  try {
    const result = await db
      .prepare(`UPDATE health_checks SET ${assignments.join(", ")} WHERE id = ?`)
      .bind(...values, healthCheckId)
      .run();
    if (result.meta.changes === 0) throw new HttpError(404, "NOT_FOUND", "Health check not found");
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "HEALTH_CHECK_EXISTS", "A check with that name already exists");
    throw error;
  }
  const row = await db.prepare(`SELECT * FROM health_checks WHERE id = ?`).bind(healthCheckId).first<Record<string, unknown>>();
  return json({ healthCheck: serializeHealthCheck(row!) });
}

// ---------------------------------------------------------------------------
// Probe — one-off check used by the onboarding wizard's "Test connection".
// Runs server-side exactly as polling will (same https rule, secret handling
// and status rules), so a browser CORS failure can't masquerade as an outage
// and a 404 can't pass as "connected". Nothing is stored.
// ---------------------------------------------------------------------------

const probeSchema = z
  .object({
    url: httpsUrl,
    expectedStatus: healthCheckFields.expectedStatus.default(200),
    authSecretName: secretName.optional(),
  })
  .strict();

export async function probeEndpoint(env: Env, body: unknown): Promise<Response> {
  const input = parseBody(probeSchema, body);
  const result = await runHealthCheck(
    {
      id: "probe",
      environment_id: "probe",
      name: "probe",
      url: input.url,
      expected_status: input.expectedStatus,
      timeout_ms: 10000,
      interval_seconds: 60,
      degraded_latency_ms: null,
      auth_secret_name: input.authSecretName ?? null,
      last_run_at: null,
    },
    env,
  );
  return json({ result });
}
