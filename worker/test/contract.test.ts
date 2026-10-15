import { describe, expect, it } from "vitest";
import { parseTelemetryEvent } from "../src/ingest/contract";
import { incidentFingerprint } from "../src/ingest/ingestEvent";
import { redactMessage, redactRoute } from "../src/ingest/redact";
import { makeEvent } from "./helpers";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("telemetry contract v1", () => {
  it("accepts the documented example event", () => {
    const { event, ignoredFields } = parseTelemetryEvent(makeEvent());
    expect(ignoredFields).toEqual([]);
    expect(event.source.component).toBe("intake");
  });

  it("rejects malformed schema versions and unsupported majors", () => {
    expect(codeOf(() => parseTelemetryEvent(makeEvent({ schemaVersion: "1" })))).toBe("INVALID_SCHEMA_VERSION");
    expect(codeOf(() => parseTelemetryEvent(makeEvent({ schemaVersion: 1 })))).toBe("INVALID_SCHEMA_VERSION");
    expect(codeOf(() => parseTelemetryEvent(makeEvent({ schemaVersion: "0.9" })))).toBe("UNSUPPORTED_SCHEMA_VERSION");
    expect(codeOf(() => parseTelemetryEvent(makeEvent({ schemaVersion: "2.0" })))).toBe("UNSUPPORTED_SCHEMA_VERSION");
  });

  it("validates field formats and bounds", () => {
    const invalid = [
      { eventId: "not-a-uuid" },
      { timestamp: "yesterday" },
      { timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
      { application: { id: "ClientFlow", environment: "production" } },
      { application: { id: "clientflow", environment: "prod" } },
      { severity: "fatal" },
      { error: { code: "lowercase_code" } },
      { error: { code: "OK", message: "x".repeat(501) } },
      { context: { statusCode: 999 } },
      { source: { service: "clientflow api", component: "intake" } },
    ];
    for (const overrides of invalid) {
      expect(codeOf(() => parseTelemetryEvent(makeEvent(overrides))), JSON.stringify(overrides)).toBe("INVALID_EVENT");
    }
  });

  it("fingerprints by application, environment, component and error code only", () => {
    const a = parseTelemetryEvent(makeEvent({ error: { code: "X_FAILED", message: "id 1" } })).event;
    const b = parseTelemetryEvent(makeEvent({ error: { code: "X_FAILED", message: "id 2" }, source: { service: "worker", component: "Intake" } })).event;
    expect(incidentFingerprint(a)).toBe("clientflow:production:intake:X_FAILED");
    expect(incidentFingerprint(b)).toBe(incidentFingerprint(a));
    expect(incidentFingerprint(parseTelemetryEvent(makeEvent({ type: "warning" })).event)).toBeNull();
  });
});

describe("redaction", () => {
  it("removes emails, bearer tokens, JWTs, query values and long tokens from messages", () => {
    expect(redactMessage("user a.b@example.org failed")).toBe("user [redacted-email] failed");
    expect(redactMessage("header Bearer sk_live_abc")).toBe("header Bearer [redacted]");
    expect(redactMessage("jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl here")).toBe("jwt [redacted-token] here");
    expect(redactMessage("GET /x?token=abc&page=2")).toBe("GET /x?token=[redacted]&page=[redacted]");
    expect(redactMessage(`key ${"a".repeat(40)}`)).toBe("key [redacted-token]");
    expect(redactMessage("Unable to persist intake submission")).toBe("Unable to persist intake submission");
  });

  it("normalizes concrete routes toward templates", () => {
    expect(redactRoute("/public/intake/submit")).toBe("/public/intake/submit");
    expect(redactRoute("/clients/3f1c2b9a-1d2e-4f5a-8b6c-7d8e9f0a1b2c/edit")).toBe("/clients/:id/edit");
    expect(redactRoute("/agreements/Zx9_k2LmQp4rT7vWyB3nH8jD")).toBe("/agreements/:redacted");
    expect(redactRoute("/s/:token?x=1#frag")).toBe("/s/:token");
  });
});
