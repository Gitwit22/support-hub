import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OnboardingError,
  joinUrl,
  onboardProgram,
  probeEndpoint,
  suggestSecretName,
  toMonitoringEnvironment,
  type OnboardingPlan,
  type OnboardingProgress,
} from "./monitoring";

type Handler = (body: unknown) => { status: number; body: unknown };

/** Minimal in-memory stand-in for the monitoring API routes the wizard uses. */
function fakeApi(overrides: Record<string, Handler> = {}) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const routes: Record<string, Handler> = {
    "POST /api/v1/applications": () => ({ status: 201, body: { application: { id: "clientflow" } } }),
    "POST /api/v1/applications/clientflow/environments": () => ({ status: 201, body: { environment: { id: "env-1" } } }),
    "POST /api/v1/environments/env-1/health-checks": () => ({ status: 201, body: { healthCheck: {} } }),
    "POST /api/v1/environments/env-1/keys": () => ({ status: 201, body: { key: { id: "abc123abc123" }, token: "shk_abc123abc123_secret" } }),
    ...overrides,
  };
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    const { status, body: payload } = handler ? handler(body) : { status: 404, body: { error: { code: "NOT_FOUND", message: "No route" } } };
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return calls;
}

const conflict = (code: string): Handler => () => ({ status: 409, body: { error: { code, message: code } } });

const plan: OnboardingPlan = {
  applicationId: "clientflow",
  name: "ClientFlow",
  environment: "production",
  baseUrl: "https://clientflow.example.com",
  healthChecks: [
    { name: "live", path: "/api/v1/health/live", requiresAuth: false },
    { name: "dependencies", path: "/api/v1/health/dependencies", requiresAuth: true },
  ],
  authSecretName: "HC_CLIENTFLOW_PROD",
  keyLabel: "ClientFlow production (onboarding)",
};

describe("onboardProgram", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("registers application, environment, health checks and a key in order", async () => {
    const calls = fakeApi();
    const progress: OnboardingProgress[] = [];
    const result = await onboardProgram(plan, (p) => progress.push(p));

    expect(result).toEqual({
      applicationId: "clientflow",
      environmentId: "env-1",
      telemetryKey: { id: "abc123abc123", token: "shk_abc123abc123_secret" },
    });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /api/v1/applications",
      "POST /api/v1/applications/clientflow/environments",
      "POST /api/v1/environments/env-1/health-checks",
      "POST /api/v1/environments/env-1/health-checks",
      "POST /api/v1/environments/env-1/keys",
    ]);
    expect(calls[1].body).toEqual({ environment: "production", baseUrl: "https://clientflow.example.com" });
    // Only the check that requires auth carries the secret name; the URL is base + path.
    expect(calls[2].body).toEqual({ name: "live", url: "https://clientflow.example.com/api/v1/health/live" });
    expect(calls[3].body).toEqual({
      name: "dependencies",
      url: "https://clientflow.example.com/api/v1/health/dependencies",
      authSecretName: "HC_CLIENTFLOW_PROD",
    });
    expect(progress.filter((p) => p.status === "done").map((p) => p.step)).toEqual([
      "application",
      "environment",
      "healthChecks",
      "telemetryKey",
    ]);
  });

  it("re-runs safely: reuses an existing application, environment and checks", async () => {
    const calls = fakeApi({
      "POST /api/v1/applications": conflict("APPLICATION_EXISTS"),
      "POST /api/v1/applications/clientflow/environments": conflict("ENVIRONMENT_EXISTS"),
      "GET /api/v1/applications/clientflow": () => ({
        status: 200,
        body: { application: { id: "clientflow", environments: [{ id: "env-1", environment: "production" }] } },
      }),
      "POST /api/v1/environments/env-1/health-checks": conflict("HEALTH_CHECK_EXISTS"),
    });
    const progress: OnboardingProgress[] = [];
    const result = await onboardProgram(plan, (p) => progress.push(p));

    expect(result.environmentId).toBe("env-1");
    expect(progress.find((p) => p.step === "environment" && p.status === "done")?.detail).toMatch(/reusing/);
    expect(progress.find((p) => p.step === "healthChecks" && p.status === "done")?.detail).toMatch(/2 already existed/);
    expect(calls.filter((c) => c.path.endsWith("/keys"))).toHaveLength(1);
  });

  it("stops at the failing step, issues no key, and reports which step failed", async () => {
    const calls = fakeApi({
      "POST /api/v1/environments/env-1/health-checks": () => ({
        status: 400,
        body: { error: { code: "VALIDATION_FAILED", message: "Request body is invalid", issues: [{ path: "url", message: "must use https" }] } },
      }),
    });
    const error = await onboardProgram(plan).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OnboardingError);
    expect((error as OnboardingError).step).toBe("healthChecks");
    expect((error as OnboardingError).apiError.issues[0].path).toBe("url");
    expect(calls.some((c) => c.path.endsWith("/keys"))).toBe(false);
  });

  it("surfaces an unreachable or unauthenticated Support Hub API as a failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;
    const network = await onboardProgram(plan).catch((e: unknown) => e);
    expect((network as OnboardingError).step).toBe("application");
    expect((network as OnboardingError).message).toMatch(/unreachable/);

    fakeApi({ "POST /api/v1/applications": () => ({ status: 401, body: { error: { code: "UNAUTHORIZED", message: "A valid Cloudflare Access session is required" } } }) });
    const unauthorized = await onboardProgram(plan).catch((e: unknown) => e);
    expect((unauthorized as OnboardingError).apiError.code).toBe("UNAUTHORIZED");
  });
});

describe("monitoring helpers", () => {
  it("maps wizard values onto the backend contract", () => {
    expect(toMonitoringEnvironment("dev")).toBe("development");
    expect(toMonitoringEnvironment("production")).toBe("production");
    expect(suggestSecretName("clientflow", "production")).toBe("HC_CLIENTFLOW_PROD");
    expect(suggestSecretName("ticket-time", "dev")).toBe("HC_TICKET_TIME_DEV");
    expect(joinUrl("https://x.example.com/", "/api/v1/health/live")).toBe("https://x.example.com/api/v1/health/live");
  });

  it("probes through the Support Hub backend, not directly from the browser", async () => {
    const calls = fakeApi({
      "POST /api/v1/probe": () => ({ status: 200, body: { result: { status: "up", httpStatus: 200, latencyMs: 80, errorType: null, errorMessage: null } } }),
    });
    const result = await probeEndpoint("https://clientflow.example.com/api/v1/health/live");
    expect(result.status).toBe("up");
    expect(calls).toEqual([{ method: "POST", path: "/api/v1/probe", body: { url: "https://clientflow.example.com/api/v1/health/live" } }]);
  });
});
