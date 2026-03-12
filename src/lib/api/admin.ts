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
} from "@/lib/types/admin";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Monitoring / Health
// ---------------------------------------------------------------------------

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  return apiFetch<MonitoringOverview>("/admin/monitoring");
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export async function listDiagnostics(): Promise<DiagnosticEntry[]> {
  return apiFetch<DiagnosticEntry[]>("/admin/diagnostics");
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function listRooms(): Promise<Room[]> {
  return apiFetch<Room[]>("/admin/rooms");
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function listAlerts(): Promise<Alert[]> {
  return apiFetch<Alert[]>("/admin/alerts");
}

// ---------------------------------------------------------------------------
// Usage / Metering
// ---------------------------------------------------------------------------

export async function getUsageMetrics(): Promise<UsageMetrics> {
  return apiFetch<UsageMetrics>("/admin/usage");
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export async function listWebhooks(): Promise<Webhook[]> {
  return apiFetch<Webhook[]>("/admin/webhooks");
}

// ---------------------------------------------------------------------------
// Dashboard Summary
// ---------------------------------------------------------------------------

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  return apiFetch<AdminDashboardSummary>("/admin/dashboard");
}

// ---------------------------------------------------------------------------
// Admin Monitoring – granular endpoints (routes/adminMonitoring)
// ---------------------------------------------------------------------------

/** GET /api/admin/monitoring/overview — health summary (webhooks, active rooms, pending support) */
export async function getMonitoringHealthSummary(): Promise<MonitoringHealthSummary> {
  return apiFetch<MonitoringHealthSummary>("/admin/monitoring/overview");
}

/** GET /api/admin/monitoring/services — service status (API, Firestore, LiveKit, hooks, Horizon) */
export async function getMonitoringServiceStatus(): Promise<MonitoringServiceStatus> {
  return apiFetch<MonitoringServiceStatus>("/admin/monitoring/services");
}

/** GET /api/admin/monitoring/webhooks — webhook delivery log (paginated, filterable) */
export async function getWebhookDeliveryLog(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  event?: string;
}): Promise<WebhookDeliveryLog> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.status) query.set("status", params.status);
  if (params?.event) query.set("event", params.event);
  const qs = query.toString();
  return apiFetch<WebhookDeliveryLog>(`/admin/monitoring/webhooks${qs ? `?${qs}` : ""}`);
}

/** GET /api/admin/alerts — recent alerts from horizon_events */
export async function getRecentAlerts(): Promise<Alert[]> {
  return apiFetch<Alert[]>("/admin/alerts");
}

/** GET /api/admin/rooms/active — live rooms */
export async function getActiveRooms(): Promise<ActiveRoom[]> {
  return apiFetch<ActiveRoom[]>("/admin/rooms/active");
}

/** GET /api/admin/support/tickets — support tickets */
export async function getAdminSupportTickets(): Promise<AdminSupportTicket[]> {
  return apiFetch<AdminSupportTicket[]>("/admin/support/tickets");
}
