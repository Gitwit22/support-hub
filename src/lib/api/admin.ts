import type {
  MonitoringOverview,
  ServiceHealth,
  DiagnosticEntry,
  Room,
  Alert,
  UsageMetrics,
  Webhook,
  AdminDashboardSummary,
} from "@/lib/types/admin";

// Simulated delay
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Monitoring / Health
// ---------------------------------------------------------------------------

const mockServices: ServiceHealth[] = [
  { name: "API Gateway", status: "healthy", latencyMs: 42, checkedAt: "2026-03-09T18:30:00Z", message: "All endpoints responding" },
  { name: "Database", status: "healthy", latencyMs: 8, checkedAt: "2026-03-09T18:30:00Z", message: "Primary cluster OK" },
  { name: "WebSocket Server", status: "healthy", latencyMs: 15, checkedAt: "2026-03-09T18:30:00Z", message: "2,140 active connections" },
  { name: "Livestream / Rooms", status: "degraded", latencyMs: 320, checkedAt: "2026-03-09T18:30:00Z", message: "Elevated latency on US-East region" },
  { name: "Webhook Delivery", status: "healthy", latencyMs: 95, checkedAt: "2026-03-09T18:30:00Z", message: "3 failed in last hour" },
  { name: "Auth Service", status: "healthy", latencyMs: 22, checkedAt: "2026-03-09T18:30:00Z", message: "OAuth + session OK" },
  { name: "Storage / CDN", status: "healthy", latencyMs: 55, checkedAt: "2026-03-09T18:30:00Z", message: "99.99% availability" },
  { name: "Search Index", status: "healthy", latencyMs: 31, checkedAt: "2026-03-09T18:30:00Z", message: "Index up to date" },
];

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  await delay();
  const hasDown = mockServices.some((s) => s.status === "down");
  const hasDegraded = mockServices.some((s) => s.status === "degraded");
  return {
    services: mockServices,
    overallStatus: hasDown ? "down" : hasDegraded ? "degraded" : "healthy",
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

const mockDiagnostics: DiagnosticEntry[] = [
  { id: "d-001", severity: "error", source: "API Gateway", message: "502 Bad Gateway on /api/rooms/active", timestamp: "2026-03-09T18:10:00Z", details: "Upstream timeout after 30s" },
  { id: "d-002", severity: "error", source: "Webhook Delivery", message: "Failed to deliver to https://hooks.example.com/events", timestamp: "2026-03-09T17:55:00Z", details: "Connection refused" },
  { id: "d-003", severity: "warning", source: "Livestream / Rooms", message: "High latency detected for region US-East", timestamp: "2026-03-09T17:40:00Z", details: "p99 latency > 300ms" },
  { id: "d-004", severity: "warning", source: "Database", message: "Slow query detected on tickets table", timestamp: "2026-03-09T17:20:00Z", details: "Query took 2.1s, threshold 1s" },
  { id: "d-005", severity: "info", source: "Auth Service", message: "OAuth token refresh spike (142 req/min)", timestamp: "2026-03-09T17:00:00Z" },
  { id: "d-006", severity: "error", source: "API Gateway", message: "Rate limit exceeded for tenant-abc", timestamp: "2026-03-09T16:45:00Z", details: "429 returned 12 times" },
  { id: "d-007", severity: "warning", source: "Storage / CDN", message: "Cache hit ratio dropped to 78%", timestamp: "2026-03-09T16:30:00Z" },
  { id: "d-008", severity: "info", source: "Search Index", message: "Re-index completed successfully", timestamp: "2026-03-09T16:00:00Z" },
];

export async function listDiagnostics(): Promise<DiagnosticEntry[]> {
  await delay();
  return [...mockDiagnostics].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

const mockRooms: Room[] = [
  { id: "r-001", name: "Math 101 – Period 3", type: "classroom", status: "active", participants: 28, maxParticipants: 35, createdAt: "2026-03-09T13:00:00Z", lastActivityAt: "2026-03-09T18:25:00Z" },
  { id: "r-002", name: "Staff Meeting – Weekly", type: "meeting", status: "active", participants: 12, maxParticipants: 50, createdAt: "2026-03-09T17:00:00Z", lastActivityAt: "2026-03-09T18:20:00Z" },
  { id: "r-003", name: "Science Fair Broadcast", type: "broadcast", status: "active", participants: 156, maxParticipants: 500, createdAt: "2026-03-09T16:00:00Z", lastActivityAt: "2026-03-09T18:28:00Z", broadcastActive: true },
  { id: "r-004", name: "PTA Webinar – Spring Update", type: "webinar", status: "active", participants: 89, maxParticipants: 200, createdAt: "2026-03-09T18:00:00Z", lastActivityAt: "2026-03-09T18:30:00Z" },
  { id: "r-005", name: "Art Workshop", type: "classroom", status: "idle", participants: 0, maxParticipants: 30, createdAt: "2026-03-09T10:00:00Z", lastActivityAt: "2026-03-09T15:00:00Z" },
  { id: "r-006", name: "District Admin Sync", type: "meeting", status: "closed", participants: 0, maxParticipants: 20, createdAt: "2026-03-09T09:00:00Z", lastActivityAt: "2026-03-09T10:30:00Z" },
];

export async function listRooms(): Promise<Room[]> {
  await delay();
  return [...mockRooms].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const mockAlerts: Alert[] = [
  { id: "a-001", title: "Elevated error rate on API Gateway", severity: "high", status: "active", service: "API Gateway", message: "Error rate exceeded 5% threshold", createdAt: "2026-03-09T17:45:00Z", updatedAt: "2026-03-09T18:15:00Z" },
  { id: "a-002", title: "Livestream latency spike (US-East)", severity: "medium", status: "active", service: "Livestream / Rooms", message: "p99 latency > 300ms in US-East", createdAt: "2026-03-09T17:30:00Z", updatedAt: "2026-03-09T18:00:00Z" },
  { id: "a-003", title: "Webhook delivery failures", severity: "low", status: "acknowledged", service: "Webhook Delivery", message: "3 consecutive failures to hooks.example.com", createdAt: "2026-03-09T16:00:00Z", updatedAt: "2026-03-09T17:00:00Z" },
  { id: "a-004", title: "Database connection pool near capacity", severity: "medium", status: "resolved", service: "Database", message: "Connection pool at 92% — resolved after scaling", createdAt: "2026-03-09T14:00:00Z", updatedAt: "2026-03-09T15:30:00Z", resolvedAt: "2026-03-09T15:30:00Z" },
  { id: "a-005", title: "SSL certificate expiring soon", severity: "info", status: "active", service: "Auth Service", message: "Certificate expires in 14 days", createdAt: "2026-03-08T10:00:00Z", updatedAt: "2026-03-08T10:00:00Z" },
];

export async function listAlerts(): Promise<Alert[]> {
  await delay();
  return [...mockAlerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ---------------------------------------------------------------------------
// Usage / Metering
// ---------------------------------------------------------------------------

export async function getUsageMetrics(): Promise<UsageMetrics> {
  await delay();
  return {
    ticketsToday: 14,
    activeUsers: 1_247,
    roomsCreated: 38,
    messagesSent: 4_812,
    streamMinutes: 2_340,
    apiRequests: 128_450,
    recordingsCreated: 7,
    hlsMinutes: 1_120,
  };
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

const mockWebhooks: Webhook[] = [
  { id: "wh-001", url: "https://hooks.example.com/events", events: ["ticket.created", "ticket.updated"], status: "failing", lastDeliveryAt: "2026-03-09T17:55:00Z", lastStatusCode: 0, failureCount: 3, createdAt: "2026-01-15T10:00:00Z" },
  { id: "wh-002", url: "https://api.slack.com/webhooks/abc123", events: ["alert.created", "alert.resolved"], status: "active", lastDeliveryAt: "2026-03-09T18:10:00Z", lastStatusCode: 200, failureCount: 0, createdAt: "2026-02-01T08:00:00Z" },
  { id: "wh-003", url: "https://analytics.internal.io/ingest", events: ["room.created", "room.closed", "usage.report"], status: "active", lastDeliveryAt: "2026-03-09T18:25:00Z", lastStatusCode: 200, failureCount: 0, createdAt: "2026-02-20T14:00:00Z" },
  { id: "wh-004", url: "https://backup.example.com/mirror", events: ["ticket.created"], status: "disabled", lastDeliveryAt: "2026-02-28T12:00:00Z", lastStatusCode: 200, failureCount: 0, createdAt: "2025-12-01T09:00:00Z" },
];

export async function listWebhooks(): Promise<Webhook[]> {
  await delay();
  return [...mockWebhooks];
}

// ---------------------------------------------------------------------------
// Dashboard Summary — aggregates data from other modules
// ---------------------------------------------------------------------------

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  await delay(150);
  const [monitoring, alerts, usage] = await Promise.all([
    getMonitoringOverview(),
    listAlerts(),
    getUsageMetrics(),
  ]);

  return {
    openTickets: 3, // pulled from support mock data count
    urgentTickets: 2,
    activeRooms: 4,
    overallHealth: monitoring.overallStatus,
    activeAlerts: alerts.filter((a) => a.status === "active").length,
    ticketsToday: usage.ticketsToday,
    activeUsers: usage.activeUsers,
  };
}
