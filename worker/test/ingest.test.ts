import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createTestContext, makeEvent, registerApp, resetDatabase, sendEvent, type Registered, type TestContext } from "./helpers";

let ctx: TestContext;
let app: Registered;

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

async function incidentRows() {
  const { results } = await ctx.db.prepare(`SELECT * FROM incidents ORDER BY created_at`).all<Record<string, unknown>>();
  return results;
}

describe("telemetry authentication", () => {
  it("rejects a missing, malformed, unknown or revoked key with the same 401", async () => {
    const event = makeEvent();
    const responses = [
      await call(ctx.env, "POST", "/api/v1/events", event),
      await sendEvent(ctx.env, "not-a-key", event),
      await sendEvent(ctx.env, `shk_${"a".repeat(12)}_${"b".repeat(43)}`, event),
    ];
    await call(ctx.env, "POST", `/api/v1/keys/${app.keyId}/revoke`);
    responses.push(await sendEvent(ctx.env, app.token, event));

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe("INVALID_TELEMETRY_KEY");
    }
    expect((await ctx.db.prepare(`SELECT COUNT(*) AS n FROM events`).first<{ n: number }>())!.n).toBe(0);
  });

  it("rejects a key used for a different application or environment", async () => {
    await registerApp(ctx.env, "mejay", "production");
    const asOtherApp = await sendEvent(ctx.env, app.token, makeEvent({ application: { id: "mejay", environment: "production" } }));
    const asOtherEnv = await sendEvent(ctx.env, app.token, makeEvent({ application: { id: "clientflow", environment: "staging" } }));
    expect(asOtherApp.status).toBe(403);
    expect(asOtherEnv.status).toBe(403);
  });

  it("stores only a hash of the token", async () => {
    const { results } = await ctx.db.prepare(`SELECT * FROM telemetry_keys`).all<Record<string, unknown>>();
    expect(results).toHaveLength(1);
    expect(JSON.stringify(results)).not.toContain(app.token);
    expect(results[0].key_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not list token material when listing keys", async () => {
    const response = await call(ctx.env, "GET", `/api/v1/environments/${app.environmentId}/keys`);
    const text = await response.text();
    expect(text).not.toContain(app.token);
    expect(text).not.toContain("key_hash");
  });
});

describe("contract enforcement", () => {
  it("requires schemaVersion and rejects unsupported major versions", async () => {
    const missing = await sendEvent(ctx.env, app.token, makeEvent({ schemaVersion: undefined }));
    const v2 = await sendEvent(ctx.env, app.token, makeEvent({ schemaVersion: "2.0" }));
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe("INVALID_SCHEMA_VERSION");
    expect(v2.status).toBe(400);
    const body = (await v2.json()) as { error: { code: string; supportedMajorVersions: number[] } };
    expect(body.error.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
    expect(body.error.supportedMajorVersions).toEqual([1]);
  });

  it("accepts a newer minor version, drops unknown fields and reports them", async () => {
    const response = await sendEvent(
      ctx.env,
      app.token,
      makeEvent({
        schemaVersion: "1.3",
        clientEmail: "jane@example.com",
        context: { requestId: "r1", authorization: "Bearer secret-value", intakeAnswers: { q1: "private" } },
      }),
    );
    expect(response.status).toBe(202);
    const body = (await response.json()) as { ignoredFields: string[] };
    expect(body.ignoredFields.sort()).toEqual(["clientEmail", "context.authorization", "context.intakeAnswers"]);

    const stored = await ctx.db.prepare(`SELECT * FROM events`).first<Record<string, unknown>>();
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain("jane@example.com");
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("private");
    expect(JSON.parse(stored!.context_json as string)).toEqual({ requestId: "r1" });
  });

  it("redacts personal data and tokens that slip into messages and routes", async () => {
    await sendEvent(
      ctx.env,
      app.token,
      makeEvent({
        error: { code: "EMAIL_SEND_FAILED", message: "Send to jane@example.com failed with Bearer abc.def.ghi" },
        context: { route: "/s/Zx9_k2LmQp4rT7vWyB3nH8jD?ref=mail" },
      }),
    );
    const stored = await ctx.db.prepare(`SELECT message, context_json FROM events`).first<{ message: string; context_json: string }>();
    expect(stored!.message).toBe("Send to [redacted-email] failed with Bearer [redacted]");
    expect(JSON.parse(stored!.context_json).route).toBe("/s/:redacted");
  });

  it("rejects error events without an error code, and oversized or non-JSON bodies", async () => {
    const noError = await sendEvent(ctx.env, app.token, makeEvent({ error: undefined }));
    expect(noError.status).toBe(400);

    const huge = await sendEvent(ctx.env, app.token, JSON.stringify({ ...makeEvent(), padding: "x".repeat(20_000) }));
    expect(huge.status).toBe(413);

    const notJson = await sendEvent(ctx.env, app.token, "{not json");
    expect(notJson.status).toBe(400);
  });
});

describe("idempotency and incident grouping", () => {
  it("treats a retried eventId as a duplicate without double counting", async () => {
    const event = makeEvent();
    const first = await sendEvent(ctx.env, app.token, event);
    const retry = await sendEvent(ctx.env, app.token, event);

    expect(first.status).toBe(202);
    const firstBody = (await first.json()) as { duplicate: boolean; incidentId: string };
    expect(firstBody.duplicate).toBe(false);
    expect(firstBody.incidentId).toBeTruthy();
    expect(retry.status).toBe(200);
    expect(((await retry.json()) as { duplicate: boolean }).duplicate).toBe(true);

    const incidents = await incidentRows();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].occurrence_count).toBe(1);
    expect((await ctx.db.prepare(`SELECT COUNT(*) AS n FROM events`).first<{ n: number }>())!.n).toBe(1);
    expect((await ctx.db.prepare(`SELECT COUNT(*) AS n FROM incident_events`).first<{ n: number }>())!.n).toBe(1);
  });

  it("collapses fifty identical failures into one incident", async () => {
    const start = Date.parse("2026-10-15T21:31:00.000Z");
    for (let i = 0; i < 50; i++) {
      const response = await sendEvent(
        ctx.env,
        app.token,
        makeEvent({ timestamp: new Date(start + i * 6_000).toISOString(), error: { code: "INTAKE_SUBMISSION_FAILED", message: `attempt ${i}` } }),
      );
      expect(response.status).toBe(202);
    }
    const incidents = await incidentRows();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      occurrence_count: 50,
      status: "open",
      component: "intake",
      error_code: "INTAKE_SUBMISSION_FAILED",
      first_seen_at: "2026-10-15T21:31:00.000Z",
      last_seen_at: new Date(start + 49 * 6_000).toISOString(),
      last_message: "attempt 49",
      fingerprint: "clientflow:production:intake:INTAKE_SUBMISSION_FAILED",
    });
    expect((await ctx.db.prepare(`SELECT COUNT(*) AS n FROM incident_events`).first<{ n: number }>())!.n).toBe(50);
  });

  it("groups concurrent submissions into a single incident", async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => sendEvent(ctx.env, app.token, makeEvent())));
    expect(responses.every((r) => r.status === 202)).toBe(true);
    const incidents = await incidentRows();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].occurrence_count).toBe(20);
  });

  it("keeps first/last seen correct when events arrive out of order", async () => {
    await sendEvent(ctx.env, app.token, makeEvent({ timestamp: "2026-10-15T21:35:00.000Z", error: { code: "INTAKE_SUBMISSION_FAILED", message: "newest" } }));
    await sendEvent(ctx.env, app.token, makeEvent({ timestamp: "2026-10-15T21:30:00.000Z", error: { code: "INTAKE_SUBMISSION_FAILED", message: "oldest" } }));
    const [incident] = await incidentRows();
    expect(incident.first_seen_at).toBe("2026-10-15T21:30:00.000Z");
    expect(incident.last_seen_at).toBe("2026-10-15T21:35:00.000Z");
    expect(incident.last_message).toBe("newest");
  });

  it("separates incidents by component, error code and environment", async () => {
    const staging = await registerApp(ctx.env, "clientflow", "staging");
    await sendEvent(ctx.env, app.token, makeEvent());
    await sendEvent(ctx.env, app.token, makeEvent({ error: { code: "CONTRACT_SEND_FAILED" } }));
    await sendEvent(ctx.env, app.token, makeEvent({ source: { service: "clientflow-api", component: "contracts" } }));
    await sendEvent(ctx.env, staging.token, makeEvent({ application: { id: "clientflow", environment: "staging" } }));
    expect(await incidentRows()).toHaveLength(4);
  });

  it("escalates severity but never lowers it", async () => {
    await sendEvent(ctx.env, app.token, makeEvent({ severity: "warning" }));
    await sendEvent(ctx.env, app.token, makeEvent({ severity: "critical" }));
    await sendEvent(ctx.env, app.token, makeEvent({ severity: "error" }));
    const [incident] = await incidentRows();
    expect(incident.severity).toBe("critical");
  });

  it("stores warnings and info events without opening incidents", async () => {
    await sendEvent(ctx.env, app.token, makeEvent({ type: "warning", severity: "warning" }));
    await sendEvent(ctx.env, app.token, makeEvent({ type: "info", severity: "info", error: undefined }));
    expect(await incidentRows()).toHaveLength(0);
    expect((await ctx.db.prepare(`SELECT COUNT(*) AS n FROM events`).first<{ n: number }>())!.n).toBe(2);
  });

  it("opens a new incident when a resolved failure recurs", async () => {
    const first = (await (await sendEvent(ctx.env, app.token, makeEvent())).json()) as { incidentId: string };
    const resolve = await call(ctx.env, "POST", `/api/v1/incidents/${first.incidentId}/resolve`);
    expect(resolve.status).toBe(200);
    expect(((await resolve.json()) as { incident: { status: string; resolvedBy: string } }).incident).toMatchObject({
      status: "resolved",
      resolvedBy: "dev@localhost",
    });

    const again = await call(ctx.env, "POST", `/api/v1/incidents/${first.incidentId}/resolve`);
    expect(((await again.json()) as { alreadyResolved: boolean }).alreadyResolved).toBe(true);

    const second = (await (await sendEvent(ctx.env, app.token, makeEvent())).json()) as { incidentId: string };
    expect(second.incidentId).not.toBe(first.incidentId);
    const incidents = await incidentRows();
    expect(incidents.map((i) => i.status).sort()).toEqual(["open", "resolved"]);
  });
});

describe("dashboard read APIs", () => {
  it("lists incidents and shows an incident with its events", async () => {
    await sendEvent(ctx.env, app.token, makeEvent());
    await sendEvent(ctx.env, app.token, makeEvent());
    const list = (await (await call(ctx.env, "GET", "/api/v1/incidents?status=open")).json()) as {
      incidents: Array<{ id: string; occurrenceCount: number; environment: string }>;
    };
    expect(list.incidents).toHaveLength(1);
    expect(list.incidents[0]).toMatchObject({ occurrenceCount: 2, environment: "production" });

    const detail = (await (await call(ctx.env, "GET", `/api/v1/incidents/${list.incidents[0].id}`)).json()) as {
      recentEvents: Array<{ errorCode: string; context: { route: string } }>;
    };
    expect(detail.recentEvents).toHaveLength(2);
    expect(detail.recentEvents[0]).toMatchObject({ errorCode: "INTAKE_SUBMISSION_FAILED", context: { route: "/public/intake/submit" } });

    const events = (await (await call(ctx.env, "GET", "/api/v1/event-log?applicationId=clientflow&type=error")).json()) as {
      events: unknown[];
    };
    expect(events.events).toHaveLength(2);
  });

  it("validates query parameters and unknown ids", async () => {
    expect((await call(ctx.env, "GET", "/api/v1/incidents?status=bogus")).status).toBe(400);
    expect((await call(ctx.env, "GET", "/api/v1/event-log?environment=prod")).status).toBe(400);
    expect((await call(ctx.env, "GET", "/api/v1/incidents/missing")).status).toBe(404);
    expect((await call(ctx.env, "GET", "/api/v1/nope")).status).toBe(404);
    expect((await call(ctx.env, "DELETE", "/api/v1/incidents")).status).toBe(405);
    expect((await call(ctx.env, "GET", "/api/v1/events")).status).toBe(405);
  });

  it("rejects duplicate registrations", async () => {
    expect((await call(ctx.env, "POST", "/api/v1/applications", { id: "clientflow", name: "x" })).status).toBe(409);
    expect((await call(ctx.env, "POST", "/api/v1/applications/clientflow/environments", { environment: "production" })).status).toBe(409);
    expect((await call(ctx.env, "POST", "/api/v1/applications", { id: "Bad Id", name: "x" })).status).toBe(400);
  });

  it("serves the UI for non-API paths", async () => {
    const response = await call(ctx.env, "GET", "/admin/monitoring");
    expect(await response.text()).toContain("ui");
  });
});
