import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clearAccessKeyCache } from "../src/auth/access";
import worker from "../src/index";
import { createTestContext, type TestContext } from "./helpers";

const TEAM = "https://nxtlvl.cloudflareaccess.com";
const AUD = "test-aud-tag";
const realFetch = globalThis.fetch;

let ctx: TestContext;
let signingKey: CryptoKey;
let publicJwk: JsonWebKey;

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(payload: Record<string, unknown>, kid = "kid-1", key = signingKey): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(new Uint8Array(signature))}`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { aud: [AUD], iss: TEAM, email: "ops@nxtlvl.tech", iat: now, exp: now + 600, ...overrides };
}

function dashboardRequest(token?: string, host = "support.nxtlvl.tech") {
  return new Request(`https://${host}/api/v1/applications`, {
    headers: token ? { "cf-access-jwt-assertion": token } : {},
  });
}

beforeAll(async () => {
  ctx = await createTestContext({ ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, AUTH_DEV_BYPASS: undefined });
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  signingKey = pair.privateKey;
  publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === `${TEAM}/cdn-cgi/access/certs`) {
        return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: "kid-1", alg: "RS256" }] }));
      }
      return realFetch(input);
    }),
  );
});
afterEach(() => clearAccessKeyCache());
afterAll(async () => {
  vi.unstubAllGlobals();
  await ctx.mf.dispose();
});

describe("Cloudflare Access verification", () => {
  it("accepts a valid Access JWT", async () => {
    const response = await worker.fetch(dashboardRequest(await signJwt(validClaims())), ctx.env);
    expect(response.status).toBe(200);
  });

  it("rejects missing, tampered, wrong-audience, wrong-issuer, expired and unknown-key tokens", async () => {
    const valid = await signJwt(validClaims());
    const [h, p, s] = valid.split(".");
    const tampered = `${h}.${b64url(JSON.stringify(validClaims({ email: "attacker@evil.test" })))}.${s}`;
    const otherKey = (
      (await crypto.subtle.generateKey(
        { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["sign", "verify"],
      )) as CryptoKeyPair
    ).privateKey;

    const tokens = [
      undefined,
      "not.a.jwt",
      tampered,
      `${h}.${p}.${b64url("bad-signature")}`,
      await signJwt(validClaims({ aud: ["another-app"] })),
      await signJwt(validClaims({ iss: "https://evil.cloudflareaccess.com" })),
      await signJwt(validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 })),
      await signJwt(validClaims(), "unknown-kid"),
      await signJwt(validClaims(), "kid-1", otherKey),
      await signJwt(validClaims({ email: undefined })),
    ];
    for (const token of tokens) {
      const response = await worker.fetch(dashboardRequest(token), ctx.env);
      expect(response.status, `token ${token?.slice(0, 20)}`).toBe(401);
    }
  });

  it("does not require Access for ingestion or Support Hub's own health endpoint", async () => {
    const health = await worker.fetch(new Request("https://support.nxtlvl.tech/api/v1/health"), ctx.env);
    expect(health.status).toBe(200);
    const ingest = await worker.fetch(
      new Request("https://support.nxtlvl.tech/api/v1/events", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }),
      ctx.env,
    );
    // Rejected by telemetry-key auth, not by Access.
    expect(((await ingest.json()) as { error: { code: string } }).error.code).toBe("INVALID_TELEMETRY_KEY");
  });

  it("fails closed when Access is not configured", async () => {
    const unconfigured = { ...ctx.env, ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined };
    const response = await worker.fetch(dashboardRequest(), unconfigured);
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("AUTH_NOT_CONFIGURED");
  });

  it("honours the dev bypass only for localhost", async () => {
    const devEnv = { ...ctx.env, ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined, AUTH_DEV_BYPASS: "true" };
    expect((await worker.fetch(dashboardRequest(undefined, "support.nxtlvl.tech"), devEnv)).status).toBe(503);
    expect((await worker.fetch(new Request("http://localhost:8787/api/v1/applications"), devEnv)).status).toBe(200);
  });
});
