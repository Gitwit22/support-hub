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
import {
  seedMonitoringOverview,
  seedDiagnostics,
  seedRooms,
  seedAlerts,
  seedUsageMetrics,
  seedWebhooks,
  seedAdminDashboardSummary,
  seedMonitoringHealthSummary,
  seedMonitoringServiceStatus,
  seedWebhookDeliveryLog,
  seedActiveRooms,
  seedAdminSupportTickets,
} from "./seedData";

// ---------------------------------------------------------------------------
// When the backend is unreachable every API function should return seed data
// instead of throwing.
// ---------------------------------------------------------------------------

describe("admin API – seed data fallback", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  });

  it("getMonitoringOverview returns seed data on network error", async () => {
    const result = await getMonitoringOverview();
    expect(result).toEqual(seedMonitoringOverview);
  });

  it("listDiagnostics returns seed data on network error", async () => {
    const result = await listDiagnostics();
    expect(result).toEqual(seedDiagnostics);
  });

  it("listRooms returns seed data on network error", async () => {
    const result = await listRooms();
    expect(result).toEqual(seedRooms);
  });

  it("listAlerts returns seed data on network error", async () => {
    const result = await listAlerts();
    expect(result).toEqual(seedAlerts);
  });

  it("getUsageMetrics returns seed data on network error", async () => {
    const result = await getUsageMetrics();
    expect(result).toEqual(seedUsageMetrics);
  });

  it("listWebhooks returns seed data on network error", async () => {
    const result = await listWebhooks();
    expect(result).toEqual(seedWebhooks);
  });

  it("getAdminDashboardSummary returns seed data on network error", async () => {
    const result = await getAdminDashboardSummary();
    expect(result).toEqual(seedAdminDashboardSummary);
  });

  it("getMonitoringHealthSummary returns seed data on network error", async () => {
    const result = await getMonitoringHealthSummary();
    expect(result).toEqual(seedMonitoringHealthSummary);
  });

  it("getMonitoringServiceStatus returns seed data on network error", async () => {
    const result = await getMonitoringServiceStatus();
    expect(result).toEqual(seedMonitoringServiceStatus);
  });

  it("getWebhookDeliveryLog returns seed data on network error", async () => {
    const result = await getWebhookDeliveryLog();
    expect(result).toEqual(seedWebhookDeliveryLog);
  });

  it("getRecentAlerts returns seed data on network error", async () => {
    const result = await getRecentAlerts();
    expect(result).toEqual(seedAlerts);
  });

  it("getActiveRooms returns seed data on network error", async () => {
    const result = await getActiveRooms();
    expect(result).toEqual(seedActiveRooms);
  });

  it("getAdminSupportTickets returns seed data on network error", async () => {
    const result = await getAdminSupportTickets();
    expect(result).toEqual(seedAdminSupportTickets);
  });
});
