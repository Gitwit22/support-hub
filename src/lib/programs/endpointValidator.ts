// ---------------------------------------------------------------------------
// Endpoint validation utility.
// Tests whether a configured endpoint is reachable and returns a useful
// response.  Used by the Settings page to diagnose misconfigured integrations.
// ---------------------------------------------------------------------------

import type { EndpointTestResult } from "@/lib/types/program";
import type { ProgramAuth } from "@/lib/types/program";

const TEST_TIMEOUT_MS = 12_000;

/**
 * Attempts to read an auth token from the Vite env vars.
 * Only works for `VITE_*` variables that were baked in at build time.
 */
function resolveToken(auth: ProgramAuth): string | null {
  if (auth.method === "none" || !auth.tokenEnvVar) return null;
  const envKey = auth.tokenEnvVar as keyof ImportMeta["env"];
  const token = (import.meta.env[envKey] as string | undefined) ?? null;
  return token || null;
}

/**
 * Classifies an HTTP status code into a human-readable failure reason.
 */
function statusReason(status: number): string {
  if (status === 401 || status === 403) return "unauthorized — check API token / auth method";
  if (status === 404) return "not found — verify the endpoint path";
  if (status === 429) return "rate limited — too many requests";
  if (status >= 500) return `server error (HTTP ${status})`;
  return `unexpected status HTTP ${status}`;
}

/**
 * Extracts top-level keys from an arbitrary JSON response body.
 * Returns an empty array when parsing fails or the body is empty.
 */
function detectKeys(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body)) {
    if (body.length > 0 && body[0] && typeof body[0] === "object") {
      return Object.keys(body[0] as object);
    }
    return [];
  }
  return Object.keys(body as object);
}

/**
 * Validates the response shape for specific endpoint categories.
 * Returns a failure reason string when invalid, or null when the shape looks
 * acceptable.
 */
function validateShape(key: string, body: unknown): string | null {
  if (!body) return "empty response body";

  if (key === "usage") {
    if (typeof body !== "object" || Array.isArray(body)) {
      return "expected an object for usage endpoint";
    }
    if (Object.keys(body as object).length === 0) {
      return "usage response is an empty object — no metric keys found";
    }
  }

  if (["resourceList", "alerts", "webhooks", "diagnostics"].includes(key)) {
    if (!Array.isArray(body)) {
      // Allow object wrappers like { data: [...] }
      if (typeof body === "object") {
        const vals = Object.values(body as object);
        const hasArray = vals.some(Array.isArray);
        if (!hasArray) return "expected an array (or object containing an array)";
      } else {
        return "expected an array response";
      }
    } else if ((body as unknown[]).length === 0) {
      return "empty array returned — may be no data or wrong path";
    }
  }

  if (key === "health" || key === "status") {
    if (typeof body !== "object" || Array.isArray(body)) {
      return "expected an object for health/status endpoint";
    }
  }

  return null;
}

/**
 * Tests a single endpoint.
 *
 * @param key       - Endpoint category key (e.g. "health", "usage").
 * @param path      - Relative path to append to baseUrl (e.g. "/api/usage").
 * @param baseUrl   - API base URL (e.g. "https://api.example.com").
 * @param auth      - Auth configuration for the program.
 */
export async function testEndpoint(
  key: string,
  path: string,
  baseUrl: string,
  auth: ProgramAuth
): Promise<EndpointTestResult> {
  const now = new Date().toISOString();

  if (!baseUrl) {
    return {
      key,
      path,
      fullUrl: path,
      reachable: false,
      validationPassed: false,
      failureReason: "no API base URL configured",
      lastTestedAt: now,
    };
  }

  const base = baseUrl.replace(/\/$/, "");
  const relative = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = base + relative;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = resolveToken(auth);
  if (token) {
    if (auth.method === "bearer") {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (auth.method === "api-key") {
      headers["X-API-Key"] = token;
    }
  }

  const start = performance.now();
  try {
    const res = await fetch(fullUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });

    const elapsed = Math.round(performance.now() - start);

    let body: unknown = null;
    let detectedKeys: string[] = [];

    try {
      body = await res.json();
      detectedKeys = detectKeys(body);
    } catch {
      // Non-JSON response is fine for some endpoints (e.g. plain-text health).
    }

    const reachable = true;
    let validationPassed = res.ok;
    let failureReason: string | undefined;

    if (!res.ok) {
      failureReason = statusReason(res.status);
    } else {
      const shapeError = validateShape(key, body);
      if (shapeError) {
        validationPassed = false;
        failureReason = shapeError;
      }
    }

    return {
      key,
      path,
      fullUrl,
      status: res.status,
      responseTimeMs: elapsed,
      reachable,
      validationPassed,
      failureReason,
      lastTestedAt: now,
      lastSuccessAt: validationPassed ? now : undefined,
      detectedKeys,
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    let failureReason = "connection failed";

    if (err instanceof DOMException && err.name === "TimeoutError") {
      failureReason = `request timed out after ${TEST_TIMEOUT_MS / 1000}s`;
    } else if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
      failureReason = "connection refused or CORS policy blocked the request";
    }

    return {
      key,
      path,
      fullUrl,
      responseTimeMs: elapsed,
      reachable: false,
      validationPassed: false,
      failureReason,
      lastTestedAt: now,
    };
  }
}

/**
 * Tests all provided endpoints in parallel and returns results keyed by
 * endpoint key.
 */
export async function testAllEndpoints(
  endpoints: Record<string, string | undefined>,
  baseUrl: string,
  auth: ProgramAuth
): Promise<Record<string, EndpointTestResult>> {
  const pairs = Object.entries(endpoints).filter(
    ([, path]) => Boolean(path)
  ) as [string, string][];

  const results = await Promise.all(
    pairs.map(([key, path]) => testEndpoint(key, path, baseUrl, auth))
  );

  return Object.fromEntries(results.map((r) => [r.key, r]));
}
