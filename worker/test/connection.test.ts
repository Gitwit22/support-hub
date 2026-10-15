import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { call, createTestContext, makeEvent, registerApp, resetDatabase, sendEvent, type Registered, type TestContext } from "./helpers";

let ctx: TestContext;
let app: Registered;

interface Report {
  verdict: string;
  ranChecks: boolean;
  steps: Array<{ id: string; ok: boolean; detail: string }>;
  healthChecks: Array<{ name: string; status: string; errorMessage: string | null }>;
  telemetry: { activeKeys: number; lastEventAt: string | null };
}

function stubFetch(status: number) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status })));
}

async function addCheck(name: string, path: string) {
  const response = await call(ctx.env, "POST", `/api/v1/environments/${app.environmentId}/health-checks`, {
    name,
    url: `https://clientflow.example.com${path}`,
  });
  expect(response.status).toBe(201);
}

async function verify(method: "POST" | "GET" = "POST"): Promise<Report> {
  const path = method === "POST" ? "verify" : "connection";
  const response = await call(ctx.env, method, `/api/v1/environments/${app.environmentId}/${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Report;
}

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.mf.dispose();
});
beforeEach(async () => {
  await resetDatabase(ctx.db);
  app = await registerApp(ctx.env);
});
afterEach(() => vi.unstubAllGlobals());

describe("connection verification", () => {
  it("is not_connected with no checks and no telemetry, and says what to do", async () => {
    const report = await verify();
    expect(report.verdict).toBe("not_connected");
    expect(report.steps).toEqual([
      { id: "health", ok: false, detail: "No enabled health checks" },
      { id: "telemetry", ok: false, detail: expect.stringContaining("set SUPPORT_HUB_URL and SUPPORT_HUB_TELEMETRY_KEY") },
    ]);
  });

  it("runs checks now and records them like scheduled polling", async () => {
    await addCheck("live", "/api/v1/health/live");
    await addCheck("ready", "/api/v1/health/ready");
    stubFetch(200);
    const report = await verify();
    expect(report.ranChecks).toBe(true);
    expect(report.healthChecks.map((c) => [c.name, c.status])).toEqual([["live", "up"], ["ready", "up"]]);
    expect(report.steps[0]).toEqual({ id: "health", ok: true, detail: "2/2 checks passing" });
    // Health alone is only partial: telemetry has not proven the key works yet.
    expect(report.verdict).toBe("partial");
    expect((await ctx.db.prepare("SELECT COUNT(*) AS n FROM health_results").first<{ n: number }>())!.n).toBe(2);
  });

  it("is connected once checks pass and the app has sent an event with an active key", async () => {
    await addCheck("live", "/api/v1/health/live");
    stubFetch(200);
    await sendEvent(ctx.env, app.token, makeEvent({ type: "info", severity: "info", error: { code: "TELEMETRY_CONNECTED" } }));
    const report = await verify();
    expect(report.verdict).toBe("connected");
    expect(report.steps[1].detail).toMatch(/^Last event \d+s ago: info TELEMETRY_CONNECTED in intake/);
  });

  it("does not count events sent with a key that has since been revoked", async () => {
    await addCheck("live", "/api/v1/health/live");
    stubFetch(200);
    await sendEvent(ctx.env, app.token, makeEvent());
    await call(ctx.env, "POST", `/api/v1/keys/${app.keyId}/revoke`);
    const report = await verify();
    expect(report.verdict).toBe("partial");
    expect(report.steps[1]).toMatchObject({ ok: false, detail: expect.stringContaining("No active telemetry key") });
  });

  it("reports failing checks by name, and GET reads the latest results without running checks", async () => {
    await addCheck("live", "/api/v1/health/live");
    stubFetch(503);
    const ran = await verify();
    expect(ran.steps[0].detail).toBe("1 failing: live");
    expect(ran.healthChecks[0].errorMessage).toBe("Expected HTTP 200, got 503");

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const read = await verify("GET");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(read.ranChecks).toBe(false);
    expect(read.healthChecks[0]).toMatchObject({ name: "live", status: "down" });
  });

  it("returns 404 for an unknown environment", async () => {
    expect((await call(ctx.env, "POST", "/api/v1/environments/nope/verify")).status).toBe(404);
  });
});
