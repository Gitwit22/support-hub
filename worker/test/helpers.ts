import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import worker from "../src/index";
import type { Env } from "../src/env";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");
const TABLES_IN_DELETE_ORDER = [
  "incident_events",
  "health_results",
  "health_checks",
  "incidents",
  "events",
  "telemetry_keys",
  "application_environments",
  "applications",
];

/** Splits a migration file into statements (no semicolons appear inside statements). */
function migrationStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export interface TestContext {
  mf: Miniflare;
  db: D1Database;
  env: Env;
}

export async function createTestContext(overrides: Partial<Env> = {}): Promise<TestContext> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: `test-${crypto.randomUUID()}` },
  });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of migrationStatements(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))) {
      await db.prepare(statement).run();
    }
  }
  const env = {
    DB: db,
    ASSETS: { fetch: async () => new Response("<html>ui</html>", { headers: { "content-type": "text/html" } }) },
    AUTH_DEV_BYPASS: "true",
    ...overrides,
  } as unknown as Env;
  return { mf, db, env };
}

export async function resetDatabase(db: D1Database): Promise<void> {
  await db.batch(TABLES_IN_DELETE_ORDER.map((table) => db.prepare(`DELETE FROM ${table}`)));
}

export const BASE = "http://localhost";

export function call(env: Env, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] ??= "application/json";
  }
  return worker.fetch(new Request(`${BASE}${path}`, init), env);
}

export interface Registered {
  applicationId: string;
  environmentId: string;
  keyId: string;
  token: string;
}

/** Registers an application + environment and issues a telemetry key through the API. */
export async function registerApp(env: Env, applicationId = "clientflow", environment = "production"): Promise<Registered> {
  const existing = await call(env, "GET", `/api/v1/applications/${applicationId}`);
  if (existing.status === 404) {
    const created = await call(env, "POST", "/api/v1/applications", { id: applicationId, name: applicationId });
    if (created.status !== 201) throw new Error(`createApplication failed: ${await created.text()}`);
  }
  const envResponse = await call(env, "POST", `/api/v1/applications/${applicationId}/environments`, { environment });
  if (envResponse.status !== 201) throw new Error(`createEnvironment failed: ${await envResponse.text()}`);
  const { environment: envRow } = (await envResponse.json()) as { environment: { id: string } };
  const keyResponse = await call(env, "POST", `/api/v1/environments/${envRow.id}/keys`, { label: "test" });
  if (keyResponse.status !== 201) throw new Error(`createTelemetryKey failed: ${await keyResponse.text()}`);
  const { key, token } = (await keyResponse.json()) as { key: { id: string }; token: string };
  return { applicationId, environmentId: envRow.id, keyId: key.id, token };
}

export function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1.0",
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    application: { id: "clientflow", environment: "production", version: "2026.10.15" },
    type: "error",
    severity: "error",
    source: { service: "clientflow-api", component: "intake" },
    error: { code: "INTAKE_SUBMISSION_FAILED", message: "Unable to persist intake submission" },
    context: { requestId: "req-123", route: "/public/intake/submit" },
    ...overrides,
  };
}

export function sendEvent(env: Env, token: string, event: unknown) {
  return call(env, "POST", "/api/v1/events", event, { authorization: `Bearer ${token}` });
}
