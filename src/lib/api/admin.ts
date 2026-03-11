import type {
  MonitoringOverview,
  DiagnosticEntry,
  Room,
  Alert,
  UsageMetrics,
  Webhook,
  AdminDashboardSummary,
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
