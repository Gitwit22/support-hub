import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMonitoringOverview,
  listDiagnostics,
  listRooms,
  listAlerts,
  getUsageMetrics,
  listWebhooks,
  getAdminDashboardSummary,
  getMonitoringHealthSummary,
  getMonitoringServiceStatus,
  getWebhookDeliveryLog,
  getRecentAlerts,
  getActiveRooms,
  getAdminSupportTickets,
} from "./admin";

// ---------------------------------------------------------------------------
// When the backend is unreachable, API reads should return empty-safe values.
// ---------------------------------------------------------------------------

describe("admin API – empty fallback", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  });

  it("getMonitoringOverview returns empty data on network error", async () => {
    const result = await getMonitoringOverview();
    expect(result.services).toEqual([]);
    expect(result.overallStatus).toBe("unknown");
  });

  it("listDiagnostics returns empty data on network error", async () => {
    const result = await listDiagnostics();
    expect(result).toEqual([]);
  });

  it("listRooms returns empty data on network error", async () => {
    const result = await listRooms();
    expect(result).toEqual([]);
  });

  it("listAlerts returns empty data on network error", async () => {
    const result = await listAlerts();
    expect(result).toEqual([]);
  });

  it("getUsageMetrics returns empty data on network error", async () => {
    const result = await getUsageMetrics();
    expect(result).toEqual({});
  });

  it("listWebhooks returns empty data on network error", async () => {
    const result = await listWebhooks();
    expect(result).toEqual([]);
  });

  it("getAdminDashboardSummary returns empty data on network error", async () => {
    const result = await getAdminDashboardSummary();
    expect(result).toEqual({
      openTickets: 0,
      urgentTickets: 0,
      activeRooms: 0,
      overallHealth: "unknown",
      activeAlerts: 0,
      ticketsToday: 0,
      activeUsers: 0,
    });
  });

  it("getMonitoringHealthSummary returns empty data on network error", async () => {
    const result = await getMonitoringHealthSummary();
    expect(result.webhooksActive).toBe(0);
    expect(result.overallStatus).toBe("unknown");
  });

  it("getMonitoringServiceStatus returns empty data on network error", async () => {
    const result = await getMonitoringServiceStatus();
    expect(result.services).toEqual([]);
  });

  it("getWebhookDeliveryLog returns empty data on network error", async () => {
    const result = await getWebhookDeliveryLog();
    expect(result).toEqual({
      deliveries: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("getRecentAlerts returns empty data on network error", async () => {
    const result = await getRecentAlerts();
    expect(result).toEqual([]);
  });

  it("getActiveRooms returns empty data on network error", async () => {
    const result = await getActiveRooms();
    expect(result).toEqual([]);
  });

  it("getAdminSupportTickets returns empty data on network error", async () => {
    const result = await getAdminSupportTickets();
    expect(result).toEqual([]);
  });
});
