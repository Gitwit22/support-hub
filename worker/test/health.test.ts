import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isDue, pruneHealthResults, runHealthCheck, type HealthCheckRow } from "../src/health/runner";
import { deriveEnvironmentStatus, type CheckSnapshot } from "../src/health/status";
import worker from "../src/index";
import { call, createTestContext, makeEvent, registerApp, resetDatabase, sendEvent, type Registered, type TestContext } from "./helpers";

let ctx: TestContext;
let app: Registered;

function check(overrides: Partial<HealthCheckRow> = {}): HealthCheckRow {
  return {
    id: "c1",
    environment_id: "e1",
    name: "api-live",
    url: "https://clientflow.example.com/api/v1/health/live",
    expected_status: 200,
    timeout_ms: 1000,
    interval_seconds: 60,
    degraded_latency_ms: null,
    auth_secret_name: null,
    last_run_at: null,
    ...overrides,
  };
}

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => impl(String(input), init));
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function runCron(time = Date.now()) {
  await worker.scheduled({ scheduledTime: time, cron: "* * * * *", noRetry() {} } as ScheduledController, ctx.env);
}

beforeAll(async () => {
  ctx = await createTestContext({ HC_CLIENTFLOW_PROD: "hc-secret" } as never);
});
afterAll(async () => {
  await ctx.mf.dispose();
});
beforeEach(async () => {
  await resetDatabase(ctx.db);
  app = await registerApp(ctx.env);
});
afterEach(() => vi.unstubAllGlobals());

describe("single health check execution", () => {
  it("classifies up, degraded, wrong status, timeout and network failures", async () => {
    stubFetch(async () => new Response("ok", { status: 200 }));
    expect((await runHealthCheck(check(), ctx.env)).status).toBe("up");

    stubFetch(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return new Response("ok");
    });
    expect(await runHealthCheck(check({ degraded_latency_ms: 5 }), ctx.env)).toMatchObject({ status: "degraded" });

    stubFetch(async () => new Response('{"database":"unreachable"}', { status: 503 }));
    expect(await runHealthCheck(check(), ctx.env)).toMatchObject({ status: "down", httpStatus: 503, errorType: "http_status" });

    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    expect(await runHealthCheck(check({ timeout_ms: 50 }), ctx.env)).toMatchObject({ status: "down", errorType: "timeout" });

    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await runHealthCheck(check(), ctx.env)).toMatchObject({ status: "down", errorType: "network" });
  });

  it("sends the configured secret and reports a missing one as a config failure", async () => {
    const mock = stubFetch(async () => new Response("ok"));
    await runHealthCheck(check({ auth_secret_name: "HC_CLIENTFLOW_PROD" }), ctx.env);
    expect((mock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer hc-secret");

    const missing = await runHealthCheck(check({ auth_secret_name: "HC_NOT_SET" }), ctx.env);
    expect(missing).toMatchObject({ status: "down", errorType: "config" });
    // Only HC_* bindings may ever be sent; anything else is treated as missing.
    const disallowed = await runHealthCheck(check({ auth_secret_name: "ACCESS_AUD" }), ctx.env);
    expect(disallowed).toMatchObject({ status: "down", errorType: "config" });
  });

  it("schedules by interval", () => {
    const now = Date.parse("2026-10-15T21:30:00.000Z");
    expect(isDue({ last_run_at: null, interval_seconds: 60 }, now)).toBe(true);
    expect(isDue({ last_run_at: "2026-10-15T21:29:00.400Z", interval_seconds: 60 }, now)).toBe(true);
    expect(isDue({ last_run_at: "2026-10-15T21:29:30.000Z", interval_seconds: 60 }, now)).toBe(false);
    expect(isDue({ last_run_at: "2026-10-15T21:29:00.000Z", interval_seconds: 300 }, now)).toBe(false);
  });
});

describe("environment status derivation", () => {
  const now = Date.parse("2026-10-15T21:30:00.000Z");
  const fresh = "2026-10-15T21:29:30.000Z";
  const snap = (overrides: Partial<CheckSnapshot>): CheckSnapshot => ({
    id: "c",
    name: "live",
    intervalSeconds: 60,
    lastStatus: "up",
    lastCheckedAt: fresh,
    ...overrides,
  });

  it("never reports healthy without fresh evidence", () => {
    expect(deriveEnvironmentStatus([], 0, now).status).toBe("unknown");
    expect(deriveEnvironmentStatus([snap({ lastStatus: null, lastCheckedAt: null })], 0, now).status).toBe("unknown");
    expect(deriveEnvironmentStatus([snap({ lastCheckedAt: "2026-10-15T21:00:00.000Z" })], 0, now).status).toBe("unknown");
  });

  it("orders down > degraded > unknown > healthy and counts critical incidents", () => {
    expect(deriveEnvironmentStatus([snap({})], 0, now).status).toBe("healthy");
    expect(deriveEnvironmentStatus([snap({}), snap({ lastStatus: "down" })], 0, now).status).toBe("down");
    expect(deriveEnvironmentStatus([snap({ lastStatus: "degraded" }), snap({ lastCheckedAt: null, lastStatus: null })], 0, now).status).toBe(
      "degraded",
    );
    const withCritical = deriveEnvironmentStatus([snap({})], 1, now);
    expect(withCritical.status).toBe("degraded");
    expect(withCritical.reasons).toContain("1 open critical incident(s)");
  });
});

describe("scheduled polling end to end", () => {
  async function addCheck(body: Record<string, unknown>) {
    const response = await call(ctx.env, "POST", `/api/v1/environments/${app.environmentId}/health-checks`, body);
    expect(response.status).toBe(201);
    return ((await response.json()) as { healthCheck: { id: string } }).healthCheck.id;
  }

  it("records results, respects intervals and surfaces status on the application", async () => {
    const liveId = await addCheck({ name: "api-live", url: "https://clientflow.example.com/api/v1/health/live" });
    await addCheck({ name: "api-ready", url: "https://clientflow.example.com/api/v1/health/ready", intervalSeconds: 300 });

    stubFetch(async () => new Response("ok"));
    const t0 = Date.now();
    await runCron(t0);
    let app1 = (await (await call(ctx.env, "GET", "/api/v1/applications/clientflow")).json()) as {
      application: { environments: Array<{ status: string; checks: Array<{ state: string }> }> };
    };
    expect(app1.application.environments[0].status).toBe("healthy");

    // One minute later only the 60s check is due.
    const mock = stubFetch(async () => new Response("nope", { status: 503 }));
    await runCron(t0 + 60_000);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(String(mock.mock.calls[0][0])).toContain("/live");

    app1 = (await (await call(ctx.env, "GET", "/api/v1/applications/clientflow")).json()) as typeof app1;
    expect(app1.application.environments[0].status).toBe("down");

    const results = (await (await call(ctx.env, "GET", `/api/v1/health-checks/${liveId}/results`)).json()) as {
      results: Array<{ status: string; httpStatus: number }>;
    };
    expect(results.results.map((r) => r.status)).toEqual(["down", "up"]);
  });

  it("skips disabled checks and validates check definitions", async () => {
    const id = await addCheck({ name: "api-live", url: "https://clientflow.example.com/api/v1/health/live" });
    const patch = await call(ctx.env, "PATCH", `/api/v1/health-checks/${id}`, { enabled: false });
    expect(patch.status).toBe(200);
    const mock = stubFetch(async () => new Response("ok"));
    await runCron();
    expect(mock).not.toHaveBeenCalled();

    const bad = [
      { name: "x", url: "http://insecure.example.com" },
      { name: "x", url: "https://ok.example.com", authSecretName: "ACCESS_AUD" },
      { name: "x", url: "https://ok.example.com", intervalSeconds: 10 },
      { name: "x", url: "https://ok.example.com", unexpected: true },
    ];
    for (const body of bad) {
      const response = await call(ctx.env, "POST", `/api/v1/environments/${app.environmentId}/health-checks`, body);
      expect(response.status).toBe(400);
    }
  });

  it("degrades a passing environment while a critical incident is open", async () => {
    await addCheck({ name: "api-live", url: "https://clientflow.example.com/api/v1/health/live" });
    stubFetch(async () => new Response("ok"));
    await runCron();
    await sendEvent(ctx.env, app.token, makeEvent({ severity: "critical" }));
    const body = (await (await call(ctx.env, "GET", "/api/v1/applications")).json()) as {
      applications: Array<{ environments: Array<{ status: string; openIncidentCount: number }> }>;
    };
    expect(body.applications[0].environments[0]).toMatchObject({ status: "degraded", openIncidentCount: 1 });
  });

  it("prunes results older than the retention window", async () => {
    const id = await addCheck({ name: "api-live", url: "https://clientflow.example.com/api/v1/health/live" });
    await ctx.db
      .prepare(`INSERT INTO health_results (id, health_check_id, status, checked_at) VALUES ('old', ?, 'up', '2026-01-01T00:00:00.000Z')`)
      .bind(id)
      .run();
    expect(await pruneHealthResults(ctx.db, Date.parse("2026-10-15T00:00:00.000Z"))).toBe(1);
  });
});
