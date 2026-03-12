import { describe, it, expect, beforeEach } from "vitest";
import {
  createEventPayload,
  ALL_EVENT_NAMES,
  CHAT_MESSAGE_CREATED,
  CHAT_MESSAGE_UPDATED,
  CHAT_MESSAGE_DELETED,
  VOICE_STREAM_STARTED,
  VOICE_STREAM_ENDED,
  VOICE_PARTICIPANT_MUTED,
  VOICE_PARTICIPANT_UNMUTED,
  SUPPORT_TICKET_CREATED,
  SUPPORT_TICKET_UPDATED,
  SUPPORT_TICKET_CLOSED,
  SUPPORT_TICKET_ASSIGNED,
  ROOM_CREATED,
  ROOM_STARTED,
  ROOM_ENDED,
  ROOM_PARTICIPANT_JOINED,
  ROOM_PARTICIPANT_LEFT,
  MONITORING_SERVICE_DEGRADED,
  MONITORING_SERVICE_RESTORED,
  MONITORING_HEALTH_CHECK,
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  ALERT_RESOLVED,
} from "./eventTypes";
import type { StreamlineEventPayload } from "./eventTypes";

describe("eventTypes", () => {
  describe("ALL_EVENT_NAMES", () => {
    it("contains exactly 22 canonical event names", () => {
      expect(ALL_EVENT_NAMES).toHaveLength(22);
    });

    it("includes all chat events", () => {
      expect(ALL_EVENT_NAMES).toContain(CHAT_MESSAGE_CREATED);
      expect(ALL_EVENT_NAMES).toContain(CHAT_MESSAGE_UPDATED);
      expect(ALL_EVENT_NAMES).toContain(CHAT_MESSAGE_DELETED);
    });

    it("includes all voice events", () => {
      expect(ALL_EVENT_NAMES).toContain(VOICE_STREAM_STARTED);
      expect(ALL_EVENT_NAMES).toContain(VOICE_STREAM_ENDED);
      expect(ALL_EVENT_NAMES).toContain(VOICE_PARTICIPANT_MUTED);
      expect(ALL_EVENT_NAMES).toContain(VOICE_PARTICIPANT_UNMUTED);
    });

    it("includes all support events", () => {
      expect(ALL_EVENT_NAMES).toContain(SUPPORT_TICKET_CREATED);
      expect(ALL_EVENT_NAMES).toContain(SUPPORT_TICKET_UPDATED);
      expect(ALL_EVENT_NAMES).toContain(SUPPORT_TICKET_CLOSED);
      expect(ALL_EVENT_NAMES).toContain(SUPPORT_TICKET_ASSIGNED);
    });

    it("includes all room events", () => {
      expect(ALL_EVENT_NAMES).toContain(ROOM_CREATED);
      expect(ALL_EVENT_NAMES).toContain(ROOM_STARTED);
      expect(ALL_EVENT_NAMES).toContain(ROOM_ENDED);
      expect(ALL_EVENT_NAMES).toContain(ROOM_PARTICIPANT_JOINED);
      expect(ALL_EVENT_NAMES).toContain(ROOM_PARTICIPANT_LEFT);
    });

    it("includes all monitoring events", () => {
      expect(ALL_EVENT_NAMES).toContain(MONITORING_SERVICE_DEGRADED);
      expect(ALL_EVENT_NAMES).toContain(MONITORING_SERVICE_RESTORED);
      expect(ALL_EVENT_NAMES).toContain(MONITORING_HEALTH_CHECK);
    });

    it("includes all alert events", () => {
      expect(ALL_EVENT_NAMES).toContain(ALERT_TRIGGERED);
      expect(ALL_EVENT_NAMES).toContain(ALERT_ACKNOWLEDGED);
      expect(ALL_EVENT_NAMES).toContain(ALERT_RESOLVED);
    });

    it("has no duplicate entries", () => {
      const unique = new Set(ALL_EVENT_NAMES);
      expect(unique.size).toBe(ALL_EVENT_NAMES.length);
    });
  });

  describe("createEventPayload", () => {
    let payload: StreamlineEventPayload<{ foo: string }>;

    beforeEach(() => {
      payload = createEventPayload(CHAT_MESSAGE_CREATED, "test-source", { foo: "bar" });
    });

    it("assigns a non-empty id", () => {
      expect(payload.id).toBeTruthy();
      expect(typeof payload.id).toBe("string");
    });

    it("sets the event name", () => {
      expect(payload.event).toBe(CHAT_MESSAGE_CREATED);
    });

    it("sets the source", () => {
      expect(payload.source).toBe("test-source");
    });

    it("includes the data", () => {
      expect(payload.data).toEqual({ foo: "bar" });
    });

    it("generates an ISO-8601 timestamp", () => {
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("generates unique ids for consecutive calls", () => {
      const p2 = createEventPayload(ROOM_CREATED, "test", {});
      expect(p2.id).not.toBe(payload.id);
    });
  });
});
