import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamlineEventBus, resetEventBus, getEventBus } from "./eventBus";
import { resetWebhookDispatcher } from "./webhookDispatcher";
import { createEventPayload, CHAT_MESSAGE_CREATED, ROOM_STARTED } from "./eventTypes";

describe("StreamlineEventBus", () => {
  let bus: StreamlineEventBus;

  beforeEach(() => {
    resetEventBus();
    resetWebhookDispatcher();
    bus = new StreamlineEventBus();
    // Stub global fetch to prevent real HTTP calls from the dispatcher
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      json: () => Promise.resolve({}),
    });
  });

  describe("on / emit", () => {
    it("delivers events to subscribed listeners", () => {
      const listener = vi.fn();
      bus.on(CHAT_MESSAGE_CREATED, listener);

      const payload = createEventPayload(CHAT_MESSAGE_CREATED, "test", { msg: "hi" });
      bus.emit(payload);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(payload);
    });

    it("does not deliver events to unrelated listeners", () => {
      const listener = vi.fn();
      bus.on(ROOM_STARTED, listener);

      bus.emit(createEventPayload(CHAT_MESSAGE_CREATED, "test", {}));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("off", () => {
    it("removes a listener", () => {
      const listener = vi.fn();
      bus.on(CHAT_MESSAGE_CREATED, listener);
      bus.off(CHAT_MESSAGE_CREATED, listener);

      bus.emit(createEventPayload(CHAT_MESSAGE_CREATED, "test", {}));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("once", () => {
    it("delivers only the first event", () => {
      const listener = vi.fn();
      bus.once(CHAT_MESSAGE_CREATED, listener);

      bus.emit(createEventPayload(CHAT_MESSAGE_CREATED, "test", {}));
      bus.emit(createEventPayload(CHAT_MESSAGE_CREATED, "test", {}));

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("listenerCount / removeAllListeners", () => {
    it("tracks listener count", () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      bus.on(CHAT_MESSAGE_CREATED, fn1);
      bus.on(CHAT_MESSAGE_CREATED, fn2);
      expect(bus.listenerCount(CHAT_MESSAGE_CREATED)).toBe(2);
    });

    it("removes all listeners for a specific event", () => {
      bus.on(CHAT_MESSAGE_CREATED, vi.fn());
      bus.on(ROOM_STARTED, vi.fn());
      bus.removeAllListeners(CHAT_MESSAGE_CREATED);
      expect(bus.listenerCount(CHAT_MESSAGE_CREATED)).toBe(0);
      expect(bus.listenerCount(ROOM_STARTED)).toBe(1);
    });

    it("removes all listeners globally", () => {
      bus.on(CHAT_MESSAGE_CREATED, vi.fn());
      bus.on(ROOM_STARTED, vi.fn());
      bus.removeAllListeners();
      expect(bus.listenerCount(CHAT_MESSAGE_CREATED)).toBe(0);
      expect(bus.listenerCount(ROOM_STARTED)).toBe(0);
    });
  });

  describe("webhook subscriptions", () => {
    it("registers and lists webhook subscriptions", () => {
      bus.registerWebhook("wh-1", "https://example.com/hook", [CHAT_MESSAGE_CREATED]);
      const subs = bus.getWebhookSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0].webhookId).toBe("wh-1");
    });

    it("unregisters webhooks", () => {
      bus.registerWebhook("wh-1", "https://example.com/hook", [CHAT_MESSAGE_CREATED]);
      bus.unregisterWebhook("wh-1");
      expect(bus.getWebhookSubscriptions()).toHaveLength(0);
    });
  });

  describe("getEventBus singleton", () => {
    it("returns the same instance on repeated calls", () => {
      const a = getEventBus();
      const b = getEventBus();
      expect(a).toBe(b);
    });

    it("returns a new instance after resetEventBus", () => {
      const a = getEventBus();
      resetEventBus();
      const b = getEventBus();
      expect(a).not.toBe(b);
    });
  });
});
