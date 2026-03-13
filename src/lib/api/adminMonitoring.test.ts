import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMonitoringHealthSummary,
  getMonitoringServiceStatus,
  getWebhookDeliveryLog,
  getRecentAlerts,
  getActiveRooms,
  getAdminSupportTickets,
} from "./admin";
import type {
  MonitoringHealthSummary,
  MonitoringServiceStatus,
  WebhookDeliveryLog,
  Alert,
  ActiveRoom,
  AdminSupportTicket,
} from "@/lib/types/admin";

// ---------------------------------------------------------------------------
// Helpers – same pattern as existing admin.test.ts
// ---------------------------------------------------------------------------

function mockFetchOnce(body: unknown, status = 200) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  });
}

function lastFetchCall() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [url, opts] = calls[calls.length - 1] as [string, RequestInit | undefined];
  return { url, opts };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleHealthSummary: MonitoringHealthSummary = {
  webhooksActive: 4,
  webhooksFailing: 1,
  activeRooms: 3,
  pendingSupportTickets: 7,
  overallStatus: "healthy",
  checkedAt: "2026-03-12T18:00:00Z",
};

const sampleServiceStatus: MonitoringServiceStatus = {
  services: [
    { name: "API", status: "healthy", latencyMs: 12, checkedAt: "2026-03-12T18:00:00Z" },
    { name: "Firestore", status: "healthy", latencyMs: 18, checkedAt: "2026-03-12T18:00:00Z" },
  ],
  checkedAt: "2026-03-12T18:00:00Z",
};

const sampleDeliveryLog: WebhookDeliveryLog = {
  deliveries: [
    { id: "del-1", webhookId: "wh-1", eventId: "evt-1", eventName: "chat.message.created", url: "https://example.com/hook", status: "success", statusCode: 200, attempt: 1, createdAt: "2026-03-12T18:00:00Z", completedAt: "2026-03-12T18:00:01Z" },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

const sampleAlerts: Alert[] = [
  { id: "a-001", title: "High error rate", severity: "high", status: "active", service: "API Gateway", message: "Error rate exceeded 5%", createdAt: "2026-03-12T17:45:00Z", updatedAt: "2026-03-12T18:15:00Z" },
];

const sampleActiveRooms: ActiveRoom[] = [
  { id: "r-001", name: "Math 101", type: "classroom", participants: 28, startedAt: "2026-03-12T13:00:00Z", lastActivityAt: "2026-03-12T18:25:00Z" },
];

const sampleSupportTickets: AdminSupportTicket[] = [
  { id: "t-001", ticketNumber: "TKT-1001", title: "Login issue", status: "open", priority: "high", createdAt: "2026-03-12T12:00:00Z", updatedAt: "2026-03-12T18:00:00Z" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin monitoring API (routes/adminMonitoring)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  describe("getMonitoringHealthSummary", () => {
    it("calls GET /admin/monitoring/overview", async () => {
      mockFetchOnce(sampleHealthSummary);
      const result = await getMonitoringHealthSummary();
      expect(result).toEqual(sampleHealthSummary);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/monitoring/overview");
    });
  });

  describe("getMonitoringServiceStatus", () => {
    it("calls GET /admin/monitoring/services", async () => {
      mockFetchOnce(sampleServiceStatus);
      const result = await getMonitoringServiceStatus();
      expect(result).toEqual(sampleServiceStatus);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/monitoring/services");
    });
  });

  describe("getWebhookDeliveryLog", () => {
    it("calls GET /admin/monitoring/webhooks with no params", async () => {
      mockFetchOnce(sampleDeliveryLog);
      const result = await getWebhookDeliveryLog();
      expect(result).toEqual(sampleDeliveryLog);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/monitoring/webhooks");
    });

    it("appends query params when provided", async () => {
      mockFetchOnce(sampleDeliveryLog);
      await getWebhookDeliveryLog({ page: 2, pageSize: 10, status: "failed", event: "room.created" });
      const { url } = lastFetchCall();
      expect(url).toContain("page=2");
      expect(url).toContain("pageSize=10");
      expect(url).toContain("status=failed");
      expect(url).toContain("event=room.created");
    });
  });

  describe("getRecentAlerts", () => {
    it("calls GET /admin/alerts", async () => {
      mockFetchOnce(sampleAlerts);
      const result = await getRecentAlerts();
      expect(result).toEqual(sampleAlerts);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/alerts");
    });
  });

  describe("getActiveRooms", () => {
    it("calls GET /admin/rooms/active", async () => {
      mockFetchOnce(sampleActiveRooms);
      const result = await getActiveRooms();
      expect(result).toEqual(sampleActiveRooms);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/rooms/active");
    });
  });

  describe("getAdminSupportTickets", () => {
    it("calls GET /admin/support/tickets", async () => {
      mockFetchOnce(sampleSupportTickets);
      const result = await getAdminSupportTickets();
      expect(result).toEqual(sampleSupportTickets);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/support/tickets");
    });
  });
});
