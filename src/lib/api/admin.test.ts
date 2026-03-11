import { describe, it, expect } from "vitest";
import {
  getMonitoringOverview,
  listDiagnostics,
  listRooms,
  listAlerts,
  getUsageMetrics,
  listWebhooks,
  getAdminDashboardSummary,
} from "./admin";

describe("admin API", () => {
  describe("getMonitoringOverview", () => {
    it("returns services with overall status", async () => {
      const overview = await getMonitoringOverview();
      expect(overview.services.length).toBeGreaterThan(0);
      expect(["healthy", "degraded", "down", "unknown"]).toContain(overview.overallStatus);
      expect(overview.checkedAt).toBeTruthy();
      for (const svc of overview.services) {
        expect(svc.name).toBeTruthy();
        expect(["healthy", "degraded", "down", "unknown"]).toContain(svc.status);
        expect(svc.checkedAt).toBeTruthy();
      }
    });
  });

  describe("listDiagnostics", () => {
    it("returns entries sorted by timestamp descending", async () => {
      const entries = await listDiagnostics();
      expect(entries.length).toBeGreaterThan(0);
      for (let i = 1; i < entries.length; i++) {
        expect(new Date(entries[i - 1].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(entries[i].timestamp).getTime());
      }
      for (const entry of entries) {
        expect(entry.id).toBeTruthy();
        expect(["error", "warning", "info"]).toContain(entry.severity);
        expect(entry.source).toBeTruthy();
        expect(entry.message).toBeTruthy();
      }
    });
  });

  describe("listRooms", () => {
    it("returns rooms with required fields", async () => {
      const rooms = await listRooms();
      expect(rooms.length).toBeGreaterThan(0);
      for (const room of rooms) {
        expect(room.id).toBeTruthy();
        expect(room.name).toBeTruthy();
        expect(["classroom", "meeting", "broadcast", "webinar"]).toContain(room.type);
        expect(["active", "idle", "closed", "error"]).toContain(room.status);
        expect(room.participants).toBeGreaterThanOrEqual(0);
        expect(room.maxParticipants).toBeGreaterThan(0);
      }
    });
  });

  describe("listAlerts", () => {
    it("returns alerts sorted by creation date descending", async () => {
      const alerts = await listAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      for (let i = 1; i < alerts.length; i++) {
        expect(new Date(alerts[i - 1].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(alerts[i].createdAt).getTime());
      }
      for (const alert of alerts) {
        expect(alert.id).toBeTruthy();
        expect(alert.title).toBeTruthy();
        expect(["critical", "high", "medium", "low", "info"]).toContain(alert.severity);
        expect(["active", "acknowledged", "resolved"]).toContain(alert.status);
        expect(alert.service).toBeTruthy();
      }
    });
  });

  describe("getUsageMetrics", () => {
    it("returns all metric fields", async () => {
      const metrics = await getUsageMetrics();
      expect(metrics.ticketsToday).toBeGreaterThanOrEqual(0);
      expect(metrics.activeUsers).toBeGreaterThanOrEqual(0);
      expect(metrics.roomsCreated).toBeGreaterThanOrEqual(0);
      expect(metrics.messagesSent).toBeGreaterThanOrEqual(0);
      expect(metrics.streamMinutes).toBeGreaterThanOrEqual(0);
      expect(metrics.apiRequests).toBeGreaterThanOrEqual(0);
      expect(metrics.recordingsCreated).toBeGreaterThanOrEqual(0);
      expect(metrics.hlsMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  describe("listWebhooks", () => {
    it("returns webhooks with required fields", async () => {
      const webhooks = await listWebhooks();
      expect(webhooks.length).toBeGreaterThan(0);
      for (const wh of webhooks) {
        expect(wh.id).toBeTruthy();
        expect(wh.url).toBeTruthy();
        expect(wh.events.length).toBeGreaterThan(0);
        expect(["active", "failing", "disabled"]).toContain(wh.status);
        expect(wh.failureCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("getAdminDashboardSummary", () => {
    it("returns aggregated dashboard data", async () => {
      const summary = await getAdminDashboardSummary();
      expect(summary.openTickets).toBeGreaterThanOrEqual(0);
      expect(summary.urgentTickets).toBeGreaterThanOrEqual(0);
      expect(summary.activeRooms).toBeGreaterThanOrEqual(0);
      expect(["healthy", "degraded", "down", "unknown"]).toContain(summary.overallHealth);
      expect(summary.activeAlerts).toBeGreaterThanOrEqual(0);
      expect(summary.ticketsToday).toBeGreaterThanOrEqual(0);
      expect(summary.activeUsers).toBeGreaterThanOrEqual(0);
    });
  });
});
