// Verifies the Cloudflare Access JWT on dashboard/read API requests.
//
// Access enforces login at the edge, but the Worker verifies the assertion
// itself as well: anything that reaches the Worker without passing through
// Access (a misconfigured route, a workers.dev URL) must still be rejected.

import type { Env } from "../env";
import { HttpError } from "../http";

export interface Identity {
  /** User email, or the service-token client id for machine access. */
  subject: string;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

const KEY_CACHE_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;
const keyCache = new Map<string, CachedKeys>();

/** Test hook: drop cached signing keys. */
export function clearAccessKeyCache(): void {
  keyCache.clear();
}

function base64UrlDecode(segment: string): Uint8Array {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)));
  } catch {
    throw unauthorized();
  }
}

function unauthorized(): HttpError {
  return new HttpError(401, "UNAUTHORIZED", "A valid Cloudflare Access session is required");
}

function normalizeTeamDomain(value: string): string {
  const withScheme = value.startsWith("https://") ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

async function loadSigningKeys(teamDomain: string, forceRefresh: boolean): Promise<Map<string, CryptoKey>> {
  const cached = keyCache.get(teamDomain);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < KEY_CACHE_TTL_MS) {
    return cached.keys;
  }
  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new HttpError(503, "ACCESS_KEYS_UNAVAILABLE", "Could not load Cloudflare Access signing keys");
  }
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== "RSA") continue;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keys.set(jwk.kid, key);
  }
  keyCache.set(teamDomain, { keys, fetchedAt: Date.now() });
  return keys;
}

export async function verifyAccessJwt(token: string, teamDomainRaw: string, audience: string): Promise<Identity> {
  const teamDomain = normalizeTeamDomain(teamDomainRaw);
  const parts = token.split(".");
  if (parts.length !== 3) throw unauthorized();
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = decodeJsonSegment(headerSegment);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw unauthorized();

  let keys = await loadSigningKeys(teamDomain, false);
  let key = keys.get(header.kid);
  if (!key) {
    // Access rotates keys; refetch once before rejecting an unknown kid.
    keys = await loadSigningKeys(teamDomain, true);
    key = keys.get(header.kid);
  }
  if (!key) throw unauthorized();

  let signature: Uint8Array;
  try {
    signature = base64UrlDecode(signatureSegment);
  } catch {
    throw unauthorized();
  }
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
  );
  if (!valid) throw unauthorized();

  const payload = decodeJsonSegment(payloadSegment);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) throw unauthorized();
  if (payload.iss !== teamDomain) throw unauthorized();
  if (typeof payload.exp !== "number" || payload.exp < nowSeconds - CLOCK_SKEW_SECONDS) throw unauthorized();
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds + CLOCK_SKEW_SECONDS) throw unauthorized();

  const subject =
    typeof payload.email === "string" && payload.email
      ? payload.email
      : typeof payload.common_name === "string" && payload.common_name
        ? payload.common_name
        : undefined;
  if (!subject) throw unauthorized();
  return { subject };
}

function isLocalRequest(request: Request): boolean {
  const { hostname } = new URL(request.url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Authenticates a dashboard request. Fails closed when Access is not configured. */
export async function requireAccessIdentity(request: Request, env: Env): Promise<Identity> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    if (env.AUTH_DEV_BYPASS === "true" && isLocalRequest(request)) {
      return { subject: "dev@localhost" };
    }
    throw new HttpError(503, "AUTH_NOT_CONFIGURED", "Dashboard authentication is not configured");
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw unauthorized();
  return verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
}
