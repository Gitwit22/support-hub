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

const now = () => new Date().toISOString();

const EMPTY_MONITORING_OVERVIEW: MonitoringOverview = {
  services: [],
  overallStatus: "unknown" as ServiceStatus,
  checkedAt: now(),
};

const EMPTY_USAGE_METRICS: UsageMetrics = {
  ticketsToday: 0,
  activeUsers: 0,
  roomsCreated: 0,
  messagesSent: 0,
  streamMinutes: 0,
  apiRequests: 0,
  recordingsCreated: 0,
  hlsMinutes: 0,
};

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

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  try {
    return await apiFetch<MonitoringOverview>("/admin/monitoring");
  } catch {
    return EMPTY_MONITORING_OVERVIEW;
  }
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export async function listDiagnostics(): Promise<DiagnosticEntry[]> {
  try {
    return await apiFetch<DiagnosticEntry[]>("/admin/diagnostics");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function listRooms(): Promise<Room[]> {
  try {
    return await apiFetch<Room[]>("/admin/rooms");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function listAlerts(): Promise<Alert[]> {
  try {
    return await apiFetch<Alert[]>("/admin/alerts");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Usage / Metering
// ---------------------------------------------------------------------------

export async function getUsageMetrics(): Promise<UsageMetrics> {
  try {
    return await apiFetch<UsageMetrics>("/admin/usage");
  } catch {
    return EMPTY_USAGE_METRICS;
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export async function listWebhooks(): Promise<Webhook[]> {
  try {
    return await apiFetch<Webhook[]>("/admin/webhooks");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dashboard Summary
// ---------------------------------------------------------------------------

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  try {
    return await apiFetch<AdminDashboardSummary>("/admin/dashboard");
  } catch {
    return EMPTY_ADMIN_DASHBOARD_SUMMARY;
  }
}

// ---------------------------------------------------------------------------
// Admin Monitoring – granular endpoints (routes/adminMonitoring)
// ---------------------------------------------------------------------------

/** GET /api/admin/monitoring/overview — health summary (webhooks, active rooms, pending support) */
export async function getMonitoringHealthSummary(): Promise<MonitoringHealthSummary> {
  try {
    return await apiFetch<MonitoringHealthSummary>("/admin/monitoring/overview");
  } catch {
    return EMPTY_MONITORING_HEALTH_SUMMARY;
  }
}

/** GET /api/admin/monitoring/services — service status (API, Firestore, LiveKit, hooks, Horizon) */
export async function getMonitoringServiceStatus(): Promise<MonitoringServiceStatus> {
  try {
    return await apiFetch<MonitoringServiceStatus>("/admin/monitoring/services");
  } catch {
    return EMPTY_MONITORING_SERVICE_STATUS;
  }
}

/** GET /api/admin/monitoring/webhooks — webhook delivery log (paginated, filterable) */
export async function getWebhookDeliveryLog(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  event?: string;
}): Promise<WebhookDeliveryLog> {
  try {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.status) query.set("status", params.status);
    if (params?.event) query.set("event", params.event);
    const qs = query.toString();
    return await apiFetch<WebhookDeliveryLog>(`/admin/monitoring/webhooks${qs ? `?${qs}` : ""}`);
  } catch {
    return EMPTY_WEBHOOK_DELIVERY_LOG;
  }
}

/** GET /api/admin/alerts — recent alerts from horizon_events */
export async function getRecentAlerts(): Promise<Alert[]> {
  try {
    return await apiFetch<Alert[]>("/admin/alerts");
  } catch {
    return [];
  }
}

/** GET /api/admin/rooms/active — live rooms */
export async function getActiveRooms(): Promise<ActiveRoom[]> {
  try {
    return await apiFetch<ActiveRoom[]>("/admin/rooms/active");
  } catch {
    return [];
  }
}

/** GET /api/admin/support/tickets — support tickets */
export async function getAdminSupportTickets(): Promise<AdminSupportTicket[]> {
  try {
    return await apiFetch<AdminSupportTicket[]>("/admin/support/tickets");
  } catch {
    return [];
  }
}
