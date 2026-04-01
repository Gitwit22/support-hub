import { beforeEach, describe, expect, it, vi } from "vitest";

type StreamlineApiModule = typeof import("@/services/streamlineApi");

let api: StreamlineApiModule;

function mockJsonResponseOnce(body: unknown, status = 200) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("streamlineApi strict contract validation", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("VITE_STREAMLINE_API_BASE_URL", "https://streamline.test");
    vi.stubEnv("VITE_SUPPORT_DATA_SOURCE", "streamline");
    global.fetch = vi.fn();
    api = await import("@/services/streamlineApi");
  });

  // -------------------------------------------------------------------------
  // fetchSupportStatus
  // -------------------------------------------------------------------------

  describe("fetchSupportStatus", () => {
    it("passes when payload contains { ok: true }", async () => {
      mockJsonResponseOnce({ ok: true });
      const result = await api.fetchSupportStatus();
      expect(result.connected).toBe(true);
      expect(result.status).toBe("healthy");
    });

    it("fails when ok is missing", async () => {
      mockJsonResponseOnce({ timestamp: "2026-04-01T00:00:00Z" });

      await expect(api.fetchSupportStatus()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when ok is not a boolean", async () => {
      mockJsonResponseOnce({ ok: "true" });

      await expect(api.fetchSupportStatus()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // fetchRooms
  // -------------------------------------------------------------------------

  describe("fetchRooms", () => {
    it("passes for valid room array items", async () => {
      mockJsonResponseOnce([
        {
          id: "room-1",
          name: "Room 1",
          status: "active",
          hostUid: "host-1",
          participantCount: 3,
          createdAt: "2026-04-01T10:00:00Z",
          updatedAt: "2026-04-01T10:01:00Z",
          isLive: true,
        },
      ]);

      const result = await api.fetchRooms();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("room-1");
      expect(result[0].participants).toBe(3);
      expect(result[0].status).toBe("active");
    });

    it("fails when a room is missing id", async () => {
      mockJsonResponseOnce([{ status: "active" }]);
      await expect(api.fetchRooms()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when id is not a string", async () => {
      mockJsonResponseOnce([{ id: 123, status: "active" }]);
      await expect(api.fetchRooms()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when status is missing", async () => {
      mockJsonResponseOnce([{ id: "room-1" }]);
      await expect(api.fetchRooms()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when status is not a string", async () => {
      mockJsonResponseOnce([{ id: "room-1", status: 100 }]);
      await expect(api.fetchRooms()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when optional typed fields have wrong types", async () => {
      mockJsonResponseOnce([
        {
          id: "room-1",
          status: "active",
          hostUid: 1,
          participantCount: "3",
          createdAt: 123,
          updatedAt: false,
          isLive: "true",
        },
      ]);
      await expect(api.fetchRooms()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when unsupported room status is returned", async () => {
      mockJsonResponseOnce([{ id: "room-1", status: "paused" }]);
      await expect(api.fetchRooms()).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // fetchRoomDetails
  // -------------------------------------------------------------------------

  describe("fetchRoomDetails", () => {
    it("passes for valid room detail payload", async () => {
      mockJsonResponseOnce({
        id: "room-2",
        status: "idle",
        name: "Science",
        hostUid: null,
        participantCount: 5,
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-04-01T10:10:00Z",
        isLive: false,
        chat: {
          enabled: true,
          activeSessionId: null,
        },
      });

      const result = await api.fetchRoomDetails("room-2");
      expect(result.id).toBe("room-2");
      expect(result.status).toBe("idle");
      expect(result.participants).toBe(5);
    });

    it("fails when required fields drift", async () => {
      mockJsonResponseOnce({ name: "No ID", status: "active" });
      await expect(api.fetchRoomDetails("room-x")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when chat exists but has invalid shape", async () => {
      mockJsonResponseOnce({ id: "room-2", status: "active", chat: "enabled" });
      await expect(api.fetchRoomDetails("room-2")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when optional fields have wrong types", async () => {
      mockJsonResponseOnce({
        id: "room-2",
        status: "active",
        hostUid: 100,
        participantCount: "many",
        createdAt: 5,
        updatedAt: {},
        isLive: "yes",
      });
      await expect(api.fetchRoomDetails("room-2")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // fetchRoomChat
  // -------------------------------------------------------------------------

  describe("fetchRoomChat", () => {
    it("passes for valid chat message array", async () => {
      mockJsonResponseOnce([
        {
          id: "m-1",
          text: "Hello",
          senderIdentity: "u-1",
          senderName: "Teacher",
          senderRole: "teacher",
          isAgent: false,
          createdAt: "2026-04-01T10:11:00Z",
        },
      ]);

      const result = await api.fetchRoomChat("room-2");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("m-1");
      expect(result[0].message).toBe("Hello");
    });

    it("fails when message id is missing", async () => {
      mockJsonResponseOnce([{ text: "Hello" }]);
      await expect(api.fetchRoomChat("room-2")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when text is missing", async () => {
      mockJsonResponseOnce([{ id: "m-1" }]);
      await expect(api.fetchRoomChat("room-2")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when text is not a string", async () => {
      mockJsonResponseOnce([{ id: "m-1", text: 99 }]);
      await expect(api.fetchRoomChat("room-2")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });

    it("fails when optional fields have wrong types", async () => {
      mockJsonResponseOnce([
        {
          id: "m-1",
          text: "ok",
          senderIdentity: 10,
          senderName: false,
          senderRole: {},
          isAgent: "false",
          createdAt: 100,
        },
      ]);
      await expect(api.fetchRoomChat("room-2")).rejects.toBeInstanceOf(api.StreamlineValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // Error typing and message content
  // -------------------------------------------------------------------------

  describe("validation error typing and details", () => {
    it("validation failures throw StreamlineValidationError and type guard returns true", async () => {
      mockJsonResponseOnce({ ok: "yes" });

      try {
        await api.fetchSupportStatus();
        throw new Error("Expected validation failure");
      } catch (error) {
        expect(error).toBeInstanceOf(api.StreamlineValidationError);
        expect(api.isStreamlineValidationError(error)).toBe(true);
      }
    });

    it("normal network failures are not classified as validation errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("network down"));

      try {
        await api.fetchSupportStatus();
        throw new Error("Expected network failure");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect(api.isStreamlineValidationError(error)).toBe(false);
      }
    });

    it("validation error message includes endpoint name and field-level detail", async () => {
      mockJsonResponseOnce([{ id: "room-1" }]);

      try {
        await api.fetchRooms();
        throw new Error("Expected validation failure");
      } catch (error) {
        expect(api.isStreamlineValidationError(error)).toBe(true);
        const message = (error as Error).message;
        expect(message).toContain("GET /api/horizon/bot/support/rooms");
        expect(message).toContain("status is required and must be a non-empty string");
      }
    });
  });
});
