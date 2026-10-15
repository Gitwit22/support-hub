import type {
  MonitoringOverview,
  DiagnosticEntry,
  Room,
  Alert,
  UsageMetrics,
  Webhook,
  AdminDashboardSummary,
  MonitoringHealthSummary,
  MonitoringServiceStatus,
  WebhookDeliveryLog,
  ActiveRoom,
  AdminSupportTicket,
  ServiceStatus,
} from "@/lib/types/admin";
import { apiFetch } from "./client";
import { markEndpointAvailable, markEndpointUnavailable } from "./dataAvailability";

/**
 * Reads keep their empty fallbacks so pages still render, but every fallback
 * is recorded so the shell can flag that the data on screen is not live.
 */
async function readOrFallback<T>(endpoint: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const data = await read();
    markEndpointAvailable(endpoint);
    return data;
  } catch (error) {
    markEndpointUnavailable(endpoint, error);
    return fallback;
  }
}

const now = () => new Date().toISOString();

const EMPTY_MONITORING_OVERVIEW: MonitoringOverview = {
  services: [],
  overallStatus: "unknown" as ServiceStatus,
  checkedAt: now(),
};

const EMPTY_USAGE_METRICS: UsageMetrics = {};

const EMPTY_ADMIN_DASHBOARD_SUMMARY: AdminDashboardSummary = {
  openTickets: 0,
  urgentTickets: 0,
  activeRooms: 0,
  overallHealth: "unknown" as ServiceStatus,
  activeAlerts: 0,
  ticketsToday: 0,
  activeUsers: 0,
};

const EMPTY_MONITORING_HEALTH_SUMMARY: MonitoringHealthSummary = {
  webhooksActive: 0,
  webhooksFailing: 0,
  activeRooms: 0,
  pendingSupportTickets: 0,
  overallStatus: "unknown" as ServiceStatus,
  checkedAt: now(),
};

const EMPTY_MONITORING_SERVICE_STATUS: MonitoringServiceStatus = {
  services: [],
  checkedAt: now(),
};

const EMPTY_WEBHOOK_DELIVERY_LOG: WebhookDeliveryLog = {
  deliveries: [],
  total: 0,
  page: 1,
  pageSize: 20,
};

// ---------------------------------------------------------------------------
// Monitoring / Health
// ---------------------------------------------------------------------------

export async function getMonitoringOverview(programId?: string): Promise<MonitoringOverview> {
  return readOrFallback(
    "/admin/monitoring",
    () => apiFetch<MonitoringOverview>("/admin/monitoring", { programId }),
    EMPTY_MONITORING_OVERVIEW,
  );
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export async function listDiagnostics(programId?: string): Promise<DiagnosticEntry[]> {
  return readOrFallback(
    "/admin/diagnostics",
    () => apiFetch<DiagnosticEntry[]>("/admin/diagnostics", { programId }),
    [],
  );
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function listRooms(programId?: string): Promise<Room[]> {
  return readOrFallback(
    "/admin/rooms",
    () => apiFetch<Room[]>("/admin/rooms", { programId }),
    [],
  );
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function listAlerts(programId?: string): Promise<Alert[]> {
  return readOrFallback(
    "/admin/alerts",
    () => apiFetch<Alert[]>("/admin/alerts", { programId }),
    [],
  );
}

// ---------------------------------------------------------------------------
// Usage / Metering
// ---------------------------------------------------------------------------

export async function getUsageMetrics(period?: string, programId?: string): Promise<UsageMetrics> {
  const query = new URLSearchParams();
  if (period && period !== "all") query.set("period", encodeURIComponent(period));
  const qs = query.toString();
  return readOrFallback(
    "/admin/usage",
    () => apiFetch<UsageMetrics>(`/admin/usage${qs ? `?${qs}` : ""}`, { programId }),
    EMPTY_USAGE_METRICS,
  );
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export async function listWebhooks(programId?: string): Promise<Webhook[]> {
  return readOrFallback(
    "/admin/webhooks",
    () => apiFetch<Webhook[]>("/admin/webhooks", { programId }),
    [],
  );
}

// ---------------------------------------------------------------------------
// Dashboard Summary
// ---------------------------------------------------------------------------

export async function getAdminDashboardSummary(programId?: string): Promise<AdminDashboardSummary> {
  return readOrFallback(
    "/admin/dashboard",
    () => apiFetch<AdminDashboardSummary>("/admin/dashboard", { programId }),
    EMPTY_ADMIN_DASHBOARD_SUMMARY,
  );
}

// ---------------------------------------------------------------------------
// Admin Monitoring – granular endpoints (routes/adminMonitoring)
// ---------------------------------------------------------------------------

/** GET /api/admin/monitoring/overview — health summary (webhooks, active rooms, pending support) */
export async function getMonitoringHealthSummary(programId?: string): Promise<MonitoringHealthSummary> {
  return readOrFallback(
    "/admin/monitoring/overview",
    () => apiFetch<MonitoringHealthSummary>("/admin/monitoring/overview", { programId }),
    EMPTY_MONITORING_HEALTH_SUMMARY,
  );
}

/** GET /api/admin/monitoring/services — service status (API, Firestore, LiveKit, hooks, etc.) */
export async function getMonitoringServiceStatus(programId?: string): Promise<MonitoringServiceStatus> {
  return readOrFallback(
    "/admin/monitoring/services",
    () => apiFetch<MonitoringServiceStatus>("/admin/monitoring/services", { programId }),
    EMPTY_MONITORING_SERVICE_STATUS,
  );
}

/** GET /api/admin/monitoring/webhooks — webhook delivery log (paginated, filterable) */
export async function getWebhookDeliveryLog(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  event?: string;
  programId?: string;
}): Promise<WebhookDeliveryLog> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.status) query.set("status", params.status);
  if (params?.event) query.set("event", params.event);
  const qs = query.toString();
  return readOrFallback(
    "/admin/monitoring/webhooks",
    () =>
      apiFetch<WebhookDeliveryLog>(`/admin/monitoring/webhooks${qs ? `?${qs}` : ""}`, {
        programId: params?.programId,
      }),
    EMPTY_WEBHOOK_DELIVERY_LOG,
  );
}

/** GET /api/admin/alerts — recent alerts */
export async function getRecentAlerts(programId?: string): Promise<Alert[]> {
  return readOrFallback(
    "/admin/alerts",
    () => apiFetch<Alert[]>("/admin/alerts", { programId }),
    [],
  );
}

/** GET /api/admin/rooms/active — live rooms */
export async function getActiveRooms(programId?: string): Promise<ActiveRoom[]> {
  return readOrFallback(
    "/admin/rooms/active",
    () => apiFetch<ActiveRoom[]>("/admin/rooms/active", { programId }),
    [],
  );
}

/** GET /api/admin/support/tickets — support tickets */
export async function getAdminSupportTickets(programId?: string): Promise<AdminSupportTicket[]> {
  return readOrFallback(
    "/admin/support/tickets",
    () => apiFetch<AdminSupportTicket[]>("/admin/support/tickets", { programId }),
    [],
  );
}
