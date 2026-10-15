// Support Hub Worker: telemetry ingestion, health polling and the dashboard
// API, plus the Support Hub UI served from the same origin.
//
// Auth boundaries:
//   POST /api/v1/events  — per-application telemetry key (machine ingestion).
//   GET  /api/v1/health  — public liveness of Support Hub itself.
//   other /api/v1/*      — Cloudflare Access identity (dashboard).
// Access bypass rules match by path, not method, so the ingestion path is
// used for nothing else; the dashboard reads events from /api/v1/event-log.

import { requireAccessIdentity, type Identity } from "./auth/access";
import { authenticateTelemetryRequest } from "./auth/telemetryKeys";
import { connectionReport } from "./api/connection";
import * as read from "./api/read";
import * as registry from "./api/registry";
import type { Env } from "./env";
import { pruneHealthResults, runDueHealthChecks } from "./health/runner";
import { HttpError, errorResponse, json, nowIso, readJsonBody } from "./http";
import { parseTelemetryEvent } from "./ingest/contract";
import { ingestEvent } from "./ingest/ingestEvent";

type Params = Record<string, string>;
interface RouteContext {
  request: Request;
  env: Env;
  url: URL;
  params: Params;
  identity: Identity;
}
interface DashboardRoute {
  method: string;
  pattern: RegExp;
  handler: (ctx: RouteContext) => Promise<Response>;
}

const SEGMENT = "([^/]+)";
function route(path: string): RegExp {
  return new RegExp(`^${path.replace(/:[a-zA-Z]+/g, SEGMENT)}$`);
}
function paramNames(path: string): string[] {
  return [...path.matchAll(/:([a-zA-Z]+)/g)].map((m) => m[1]);
}

const dashboardRouteDefs: Array<[string, string, DashboardRoute["handler"]]> = [
  ["GET", "/api/v1/applications", ({ env }) => read.listApplications(env.DB)],
  ["POST", "/api/v1/applications", async ({ env, request }) => registry.createApplication(env.DB, await readJsonBody(request))],
  ["GET", "/api/v1/applications/:applicationId", ({ env, params }) => read.getApplication(env.DB, params.applicationId)],
  [
    "POST",
    "/api/v1/applications/:applicationId/environments",
    async ({ env, request, params }) => registry.createEnvironment(env.DB, params.applicationId, await readJsonBody(request)),
  ],
  ["GET", "/api/v1/environments/:environmentId/keys", ({ env, params }) => registry.listTelemetryKeys(env.DB, params.environmentId)],
  [
    "POST",
    "/api/v1/environments/:environmentId/keys",
    async ({ env, request, params, identity }) =>
      registry.createTelemetryKey(env.DB, params.environmentId, await readOptionalJsonBody(request), identity),
  ],
  ["POST", "/api/v1/keys/:keyId/revoke", ({ env, params }) => registry.revokeTelemetryKey(env.DB, params.keyId)],
  [
    "GET",
    "/api/v1/environments/:environmentId/health-checks",
    ({ env, params }) => read.listHealthChecks(env.DB, params.environmentId),
  ],
  [
    "POST",
    "/api/v1/environments/:environmentId/health-checks",
    async ({ env, request, params }) => registry.createHealthCheck(env.DB, params.environmentId, await readJsonBody(request)),
  ],
  [
    "PATCH",
    "/api/v1/health-checks/:healthCheckId",
    async ({ env, request, params }) => registry.updateHealthCheck(env.DB, params.healthCheckId, await readJsonBody(request)),
  ],
  [
    "GET",
    "/api/v1/health-checks/:healthCheckId/results",
    ({ env, params, url }) => read.listHealthResults(env.DB, params.healthCheckId, url),
  ],
  ["GET", "/api/v1/incidents", ({ env, url }) => read.listIncidents(env.DB, url)],
  ["GET", "/api/v1/incidents/:incidentId", ({ env, params, url }) => read.getIncident(env.DB, params.incidentId, url)],
  [
    "POST",
    "/api/v1/incidents/:incidentId/resolve",
    ({ env, params, identity }) => read.resolveIncident(env.DB, params.incidentId, identity),
  ],
  ["GET", "/api/v1/event-log", ({ env, url }) => read.listEvents(env.DB, url)],
  [
    "GET",
    "/api/v1/environments/:environmentId/connection",
    ({ env, params }) => connectionReport(env, params.environmentId, false),
  ],
  [
    "POST",
    "/api/v1/environments/:environmentId/verify",
    ({ env, params }) => connectionReport(env, params.environmentId, true),
  ],
  ["POST", "/api/v1/probe", async ({ env, request }) => registry.probeEndpoint(env, await readJsonBody(request))],
];

const dashboardRoutes = dashboardRouteDefs.map(([method, path, handler]) => ({
  method,
  pattern: route(path),
  names: paramNames(path),
  handler,
}));

async function readOptionalJsonBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (!request.body || length === "0") return {};
  return readJsonBody(request);
}

async function handleIngest(request: Request, env: Env): Promise<Response> {
  const principal = await authenticateTelemetryRequest(request, env.DB);
  const { event, ignoredFields } = parseTelemetryEvent(await readJsonBody(request));
  const result = await ingestEvent(env.DB, principal, event);
  return json(
    {
      accepted: true,
      duplicate: result.duplicate,
      eventId: result.eventId,
      incidentId: result.incidentId,
      ...(ignoredFields.length ? { ignoredFields } : {}),
    },
    result.duplicate ? 200 : 202,
  );
}

async function handleSelfHealth(env: Env): Promise<Response> {
  try {
    await env.DB.prepare("SELECT 1").first();
    return json({ status: "ok", service: "support-hub", database: "ok", timestamp: nowIso() });
  } catch {
    return json({ status: "error", service: "support-hub", database: "unreachable", timestamp: nowIso() }, 503);
  }
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  if (pathname === "/api/v1/events") {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST");
    return handleIngest(request, env);
  }
  if (pathname === "/api/v1/health") {
    if (request.method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use GET");
    return handleSelfHealth(env);
  }

  const candidates = dashboardRoutes
    .map((r) => ({ route: r, match: r.pattern.exec(pathname) }))
    .filter((c): c is { route: (typeof dashboardRoutes)[number]; match: RegExpExecArray } => c.match !== null);
  if (!candidates.length) throw new HttpError(404, "NOT_FOUND", "No such API route");

  // Authenticate before revealing which methods a route supports.
  const identity = await requireAccessIdentity(request, env);
  const matched = candidates.find((c) => c.route.method === request.method);
  if (!matched) throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed for this route");

  const params: Params = {};
  for (const [index, name] of matched.route.names.entries()) {
    try {
      params[name] = decodeURIComponent(matched.match[index + 1]);
    } catch {
      throw new HttpError(400, "INVALID_PATH", "Malformed path parameter");
    }
  }
  return matched.route.handler({ request, env, url, params, identity });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    try {
      return await handleApi(request, env, url);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      // Log the failure server-side without echoing internals to the caller.
      console.error(
        JSON.stringify({ msg: "unhandled_api_error", method: request.method, path: url.pathname, error: String(error) }),
      );
      return errorResponse(new HttpError(500, "INTERNAL_ERROR", "Unexpected error"));
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const summary = await runDueHealthChecks(env, controller.scheduledTime);
    console.log(JSON.stringify({ msg: "health_tick", ...summary }));
    if (new Date(controller.scheduledTime).getUTCMinutes() === 0) {
      const pruned = await pruneHealthResults(env.DB, controller.scheduledTime);
      console.log(JSON.stringify({ msg: "health_results_pruned", pruned }));
    }
  },
} satisfies ExportedHandler<Env>;
