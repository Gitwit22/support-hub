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
// Monitoring / Health
// ---------------------------------------------------------------------------

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  try {
    return await apiFetch<MonitoringOverview>("/admin/monitoring");
  } catch {
    return seedMonitoringOverview;
  }
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export async function listDiagnostics(): Promise<DiagnosticEntry[]> {
  try {
    return await apiFetch<DiagnosticEntry[]>("/admin/diagnostics");
  } catch {
    return seedDiagnostics;
  }
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function listRooms(): Promise<Room[]> {
  try {
    return await apiFetch<Room[]>("/admin/rooms");
  } catch {
    return seedRooms;
  }
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function listAlerts(): Promise<Alert[]> {
  try {
    return await apiFetch<Alert[]>("/admin/alerts");
  } catch {
    return seedAlerts;
  }
}

// ---------------------------------------------------------------------------
// Usage / Metering
// ---------------------------------------------------------------------------

export async function getUsageMetrics(): Promise<UsageMetrics> {
  try {
    return await apiFetch<UsageMetrics>("/admin/usage");
  } catch {
    return seedUsageMetrics;
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export async function listWebhooks(): Promise<Webhook[]> {
  try {
    return await apiFetch<Webhook[]>("/admin/webhooks");
  } catch {
    return seedWebhooks;
  }
}

// ---------------------------------------------------------------------------
// Dashboard Summary
// ---------------------------------------------------------------------------

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  try {
    return await apiFetch<AdminDashboardSummary>("/admin/dashboard");
  } catch {
    return seedAdminDashboardSummary;
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
    return seedMonitoringHealthSummary;
  }
}

/** GET /api/admin/monitoring/services — service status (API, Firestore, LiveKit, hooks, Horizon) */
export async function getMonitoringServiceStatus(): Promise<MonitoringServiceStatus> {
  try {
    return await apiFetch<MonitoringServiceStatus>("/admin/monitoring/services");
  } catch {
    return seedMonitoringServiceStatus;
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
    return seedWebhookDeliveryLog;
  }
}

/** GET /api/admin/alerts — recent alerts from horizon_events */
export async function getRecentAlerts(): Promise<Alert[]> {
  try {
    return await apiFetch<Alert[]>("/admin/alerts");
  } catch {
    return seedAlerts;
  }
}

/** GET /api/admin/rooms/active — live rooms */
export async function getActiveRooms(): Promise<ActiveRoom[]> {
  try {
    return await apiFetch<ActiveRoom[]>("/admin/rooms/active");
  } catch {
    return seedActiveRooms;
  }
}

/** GET /api/admin/support/tickets — support tickets */
export async function getAdminSupportTickets(): Promise<AdminSupportTicket[]> {
  try {
    return await apiFetch<AdminSupportTicket[]>("/admin/support/tickets");
  } catch {
    return seedAdminSupportTickets;
  }
}
