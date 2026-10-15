// ---------------------------------------------------------------------------
// Client for the Support Hub monitoring API (the Worker in worker/).
//
// Always same-origin /api/v1: the monitoring backend is served by the same
// Worker as this UI, independent of VITE_API_BASE_URL (which may point at a
// program's own backend). Requests carry the Cloudflare Access session cookie.
// ---------------------------------------------------------------------------

import type { ProgramEnvironment } from "@/lib/types/program";

const MONITORING_BASE = "/api/v1";

interface MonitoringTransport {
  /** "" in the browser (same origin); the Support Hub URL when used from a script. */
  origin: string;
  /** Extra headers, e.g. Cloudflare Access service-token credentials for scripts. */
  headers: Record<string, string>;
}

let transport: MonitoringTransport = { origin: "", headers: {} };

/** Points this client at a Support Hub outside the browser (scripts, agents). */
export function configureMonitoringClient(options: { origin?: string; headers?: Record<string, string> }): void {
  transport = { origin: (options.origin ?? "").replace(/\/+$/, ""), headers: options.headers ?? {} };
}

export type MonitoringEnvironment = "production" | "staging" | "development";

export class MonitoringApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "MonitoringApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${transport.origin}${MONITORING_BASE}${path}`, {
      method,
      credentials: "include",
      headers: { ...transport.headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new MonitoringApiError(0, "NETWORK_ERROR", `Support Hub API unreachable: ${(error as Error).message}`);
  }
  const text = await response.text();
  let payload: unknown = undefined;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    // Non-JSON (e.g. an HTML error page from a proxy) — fall through to the status check.
  }
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; issues?: Array<{ path: string; message: string }> } })?.error;
    throw new MonitoringApiError(
      response.status,
      error?.code ?? `HTTP_${response.status}`,
      error?.message ?? `Support Hub API returned HTTP ${response.status}`,
      error?.issues ?? [],
    );
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Validation shared with the backend contract
// ---------------------------------------------------------------------------

export const APPLICATION_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
export const SECRET_NAME_PATTERN = /^HC_[A-Z0-9_]{1,60}$/;

export function toMonitoringEnvironment(environment: ProgramEnvironment): MonitoringEnvironment {
  return environment === "dev" ? "development" : environment;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** e.g. ("clientflow", "production") → "HC_CLIENTFLOW_PROD" */
export function suggestSecretName(slug: string, environment: ProgramEnvironment): string {
  const suffix = environment === "production" ? "PROD" : environment === "staging" ? "STAGING" : "DEV";
  const base = slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `HC_${base}_${suffix}`.slice(0, 63);
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/${path.trim().replace(/^\/+/, "")}`;
}

// ---------------------------------------------------------------------------
// Probe (wizard "Test connection")
// ---------------------------------------------------------------------------

export interface ProbeResult {
  status: "up" | "degraded" | "down";
  httpStatus: number | null;
  latencyMs: number | null;
  errorType: string | null;
  errorMessage: string | null;
}

export async function probeEndpoint(url: string, authSecretName?: string): Promise<ProbeResult> {
  const { result } = await request<{ result: ProbeResult }>("POST", "/probe", {
    url,
    ...(authSecretName ? { authSecretName } : {}),
  });
  return result;
}

// ---------------------------------------------------------------------------
// Onboarding: application → environment → health checks → telemetry key
// ---------------------------------------------------------------------------

export interface PlannedHealthCheck {
  name: string;
  path: string;
  requiresAuth: boolean;
}

export interface OnboardingPlan {
  applicationId: string;
  name: string;
  description?: string;
  environment: MonitoringEnvironment;
  baseUrl: string;
  healthChecks: PlannedHealthCheck[];
  /** Worker secret (HC_*) sent as the bearer token on checks that require auth. */
  authSecretName?: string;
  keyLabel: string;
  /**
   * "always" (default) issues a new key on every run; "if-none-active" skips it
   * when the environment already has an active key, so re-runs don't pile up keys.
   */
  keyPolicy?: "always" | "if-none-active";
}

export type OnboardingStep = "application" | "environment" | "healthChecks" | "telemetryKey";

export interface OnboardingProgress {
  step: OnboardingStep;
  status: "running" | "done" | "failed";
  detail?: string;
}

export interface OnboardingResult {
  applicationId: string;
  environmentId: string;
  /** null when keyPolicy "if-none-active" found an active key and issued none. */
  telemetryKey: { id: string; token: string } | null;
}

export class OnboardingError extends Error {
  constructor(
    readonly step: OnboardingStep,
    readonly apiError: MonitoringApiError,
  ) {
    super(apiError.message);
    this.name = "OnboardingError";
  }
}

interface ApplicationView {
  id: string;
  environments: Array<{ id: string; environment: MonitoringEnvironment }>;
}

/**
 * Registers a program with the monitoring backend. Safe to re-run after a
 * partial failure: an existing application/environment is reused and an
 * existing health check (same name) is left as it is. The telemetry key is
 * issued last, so a retry never strands an unused key from an earlier attempt
 * unless that attempt got all the way to the end.
 */
export async function onboardProgram(
  plan: OnboardingPlan,
  onProgress: (progress: OnboardingProgress) => void = () => undefined,
): Promise<OnboardingResult> {
  const run = async <T>(step: OnboardingStep, action: () => Promise<{ value: T; detail: string }>): Promise<T> => {
    onProgress({ step, status: "running" });
    try {
      const { value, detail } = await action();
      onProgress({ step, status: "done", detail });
      return value;
    } catch (error) {
      const apiError =
        error instanceof MonitoringApiError ? error : new MonitoringApiError(0, "UNEXPECTED", (error as Error).message);
      onProgress({ step, status: "failed", detail: apiError.message });
      throw new OnboardingError(step, apiError);
    }
  };

  await run("application", async () => {
    try {
      await request("POST", "/applications", {
        id: plan.applicationId,
        name: plan.name,
        ...(plan.description ? { description: plan.description } : {}),
      });
      return { value: undefined, detail: "Registered" };
    } catch (error) {
      if (error instanceof MonitoringApiError && error.code === "APPLICATION_EXISTS") {
        return { value: undefined, detail: "Already registered — reusing it" };
      }
      throw error;
    }
  });

  const environmentId = await run("environment", async () => {
    try {
      const { environment } = await request<{ environment: { id: string } }>(
        "POST",
        `/applications/${encodeURIComponent(plan.applicationId)}/environments`,
        { environment: plan.environment, baseUrl: plan.baseUrl },
      );
      return { value: environment.id, detail: `${plan.environment} registered` };
    } catch (error) {
      if (!(error instanceof MonitoringApiError && error.code === "ENVIRONMENT_EXISTS")) throw error;
      const { application } = await request<{ application: ApplicationView }>(
        "GET",
        `/applications/${encodeURIComponent(plan.applicationId)}`,
      );
      const existing = application.environments.find((env) => env.environment === plan.environment);
      if (!existing) throw error;
      return { value: existing.id, detail: `${plan.environment} already registered — reusing it` };
    }
  });

  await run("healthChecks", async () => {
    const created: string[] = [];
    const kept: string[] = [];
    for (const check of plan.healthChecks) {
      try {
        await request("POST", `/environments/${encodeURIComponent(environmentId)}/health-checks`, {
          name: check.name,
          url: joinUrl(plan.baseUrl, check.path),
          ...(check.requiresAuth && plan.authSecretName ? { authSecretName: plan.authSecretName } : {}),
        });
        created.push(check.name);
      } catch (error) {
        if (error instanceof MonitoringApiError && error.code === "HEALTH_CHECK_EXISTS") kept.push(check.name);
        else throw error;
      }
    }
    const parts = [
      created.length ? `${created.length} added` : "",
      kept.length ? `${kept.length} already existed (unchanged): ${kept.join(", ")}` : "",
    ].filter(Boolean);
    return { value: undefined, detail: parts.join("; ") || "None configured" };
  });

  const telemetryKey = await run("telemetryKey", async () => {
    if (plan.keyPolicy === "if-none-active") {
      const { keys } = await request<{ keys: Array<{ id: string; revokedAt: string | null }> }>(
        "GET",
        `/environments/${encodeURIComponent(environmentId)}/keys`,
      );
      const active = keys.filter((key) => !key.revokedAt);
      if (active.length) {
        return { value: null, detail: `Active key already exists (${active.map((key) => key.id).join(", ")}); none issued` };
      }
    }
    const { key, token } = await request<{ key: { id: string }; token: string }>(
      "POST",
      `/environments/${encodeURIComponent(environmentId)}/keys`,
      { label: plan.keyLabel },
    );
    return { value: { id: key.id, token }, detail: `Key ${key.id} issued` };
  });

  return { applicationId: plan.applicationId, environmentId, telemetryKey };
}

// ---------------------------------------------------------------------------
// Connection verification
// ---------------------------------------------------------------------------

export interface ConnectionReport {
  environmentId: string;
  applicationId: string;
  applicationName: string;
  environment: MonitoringEnvironment;
  checkedAt: string;
  ranChecks: boolean;
  verdict: "connected" | "partial" | "not_connected";
  steps: Array<{ id: "health" | "telemetry"; ok: boolean; detail: string }>;
  healthChecks: Array<{
    id: string;
    name: string;
    url: string;
    status: "up" | "degraded" | "down" | "not_run";
    httpStatus: number | null;
    latencyMs: number | null;
    errorMessage: string | null;
    checkedAt: string | null;
  }>;
  telemetry: { activeKeys: number; lastKeyUsedAt: string | null; lastEventAt: string | null };
}

/**
 * runChecks: true polls every health check now (results are recorded like
 * scheduled polling); false reads the latest results and telemetry only.
 */
export async function verifyConnection(environmentId: string, options: { runChecks: boolean }): Promise<ConnectionReport> {
  const path = `/environments/${encodeURIComponent(environmentId)}/${options.runChecks ? "verify" : "connection"}`;
  return request<ConnectionReport>(options.runChecks ? "POST" : "GET", path);
}

