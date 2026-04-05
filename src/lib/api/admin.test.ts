import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMonitoringOverview,
  listDiagnostics,
  listRooms,
  listAlerts,
  getUsageMetrics,
  listWebhooks,
  getAdminDashboardSummary,
} from "./admin";
import type {
  MonitoringOverview,
  DiagnosticEntry,
  Room,
  Alert,
  UsageMetrics,
  Webhook,
  AdminDashboardSummary,
} from "@/lib/types/admin";

// ---------------------------------------------------------------------------
// Helpers – stub fetch globally for each test
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
// Sample payloads returned by the "server"
// ---------------------------------------------------------------------------

const sampleOverview: MonitoringOverview = {
  services: [
    { name: "API Gateway", status: "healthy", latencyMs: 42, checkedAt: "2026-03-09T18:30:00Z" },
  ],
  overallStatus: "healthy",
  checkedAt: "2026-03-09T18:30:00Z",
};

const sampleDiagnostics: DiagnosticEntry[] = [
  { id: "d-001", severity: "error", source: "API Gateway", message: "502 error", timestamp: "2026-03-09T18:10:00Z" },
];

const sampleRooms: Room[] = [
  { id: "r-001", name: "Math 101", type: "classroom", status: "active", participants: 28, maxParticipants: 35, createdAt: "2026-03-09T13:00:00Z", lastActivityAt: "2026-03-09T18:25:00Z" },
];

const sampleAlerts: Alert[] = [
  { id: "a-001", title: "High error rate", severity: "high", status: "active", service: "API Gateway", message: "Error rate exceeded 5%", createdAt: "2026-03-09T17:45:00Z", updatedAt: "2026-03-09T18:15:00Z" },
];

const sampleUsage: UsageMetrics = {
  ticketsToday: 14, activeUsers: 1247, roomsCreated: 38,
  messagesSent: 4812, streamMinutes: 2340, apiRequests: 128450,
  recordingsCreated: 7, hlsMinutes: 1120,
};

const sampleWebhooks: Webhook[] = [
  { id: "wh-001", url: "https://hooks.example.com/events", events: ["ticket.created"], status: "active", failureCount: 0, createdAt: "2026-01-15T10:00:00Z" },
];

const sampleSummary: AdminDashboardSummary = {
  openTickets: 3, urgentTickets: 2, activeRooms: 4,
  overallHealth: "healthy", activeAlerts: 2,
  ticketsToday: 14, activeUsers: 1247,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("admin API (real fetch)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    document.cookie = "token=; Max-Age=0; path=/";
  });

  describe("getMonitoringOverview", () => {
    it("calls GET /admin/monitoring", async () => {
      mockFetchOnce(sampleOverview);
      const result = await getMonitoringOverview();
      expect(result).toEqual(sampleOverview);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/admin/monitoring");
      expect(opts?.method).toBeUndefined();
    });
  });

  describe("listDiagnostics", () => {
    it("calls GET /admin/diagnostics", async () => {
      mockFetchOnce(sampleDiagnostics);
      const result = await listDiagnostics();
      expect(result).toEqual(sampleDiagnostics);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/diagnostics");
    });
  });

  describe("listRooms", () => {
    it("calls GET /admin/rooms", async () => {
      mockFetchOnce(sampleRooms);
      const result = await listRooms();
      expect(result).toEqual(sampleRooms);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/rooms");
    });
  });

  describe("listAlerts", () => {
    it("calls GET /admin/alerts", async () => {
      mockFetchOnce(sampleAlerts);
      const result = await listAlerts();
      expect(result).toEqual(sampleAlerts);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/alerts");
    });
  });

  describe("getUsageMetrics", () => {
    it("calls GET /admin/usage", async () => {
      mockFetchOnce(sampleUsage);
      const result = await getUsageMetrics();
      expect(result).toEqual(sampleUsage);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/usage");
    });

    it("sends Bearer auth and X-Program-Id when provided", async () => {
      document.cookie = "token=jwt-test-token; path=/";
      mockFetchOnce(sampleUsage);

      await getUsageMetrics("today", "streamline-prod");

      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/admin/usage?period=today");
      expect(opts?.credentials).toBe("include");
      expect(opts?.headers).toMatchObject({
        Authorization: "Bearer jwt-test-token",
        "X-Program-Id": "streamline-prod",
      });
    });
  });

  describe("listWebhooks", () => {
    it("calls GET /admin/webhooks", async () => {
      mockFetchOnce(sampleWebhooks);
      const result = await listWebhooks();
      expect(result).toEqual(sampleWebhooks);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/webhooks");
    });
  });

  describe("getAdminDashboardSummary", () => {
    it("calls GET /admin/dashboard", async () => {
      mockFetchOnce(sampleSummary);
      const result = await getAdminDashboardSummary();
      expect(result).toEqual(sampleSummary);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/admin/dashboard");
    });
  });
});
