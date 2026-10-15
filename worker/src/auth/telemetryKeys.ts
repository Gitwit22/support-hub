// Per-application-environment telemetry credentials.
//
// Token format: shk_<keyId>_<secret>. keyId is public and identifies the row;
// secret is 32 random bytes. Only SHA-256(token) is stored, so a database leak
// does not expose usable credentials.

import { HttpError } from "../http";

const TOKEN_PATTERN = /^shk_([a-f0-9]{12})_([A-Za-z0-9_-]{43})$/;

export interface TelemetryPrincipal {
  keyId: string;
  applicationId: string;
  environmentId: string;
  environment: string;
  lastUsedAt: string | null;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export function generateTelemetryToken(): { keyId: string; token: string } {
  const idBytes = crypto.getRandomValues(new Uint8Array(6));
  const keyId = Array.from(idBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const secret = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { keyId, token: `shk_${keyId}_${secret}` };
}

function invalidCredentials(): HttpError {
  // One message for every failure so callers cannot probe which part was wrong.
  return new HttpError(401, "INVALID_TELEMETRY_KEY", "Missing, invalid, or revoked telemetry key");
}

export async function authenticateTelemetryRequest(request: Request, db: D1Database): Promise<TelemetryPrincipal> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) throw invalidCredentials();
  const token = match[1];
  const parsed = TOKEN_PATTERN.exec(token);
  if (!parsed) throw invalidCredentials();

  const row = await db
    .prepare(
      `SELECT k.id AS key_id, k.last_used_at, e.id AS environment_id, e.application_id, e.environment
         FROM telemetry_keys k
         JOIN application_environments e ON e.id = k.environment_id
        WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    )
    .bind(await hashToken(token))
    .first<{ key_id: string; last_used_at: string | null; environment_id: string; application_id: string; environment: string }>();

  if (!row || row.key_id !== parsed[1]) throw invalidCredentials();
  return {
    keyId: row.key_id,
    applicationId: row.application_id,
    environmentId: row.environment_id,
    environment: row.environment,
    lastUsedAt: row.last_used_at,
  };
}
