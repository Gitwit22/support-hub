// ---------------------------------------------------------------------------
// Admin console shared types for monitoring, diagnostics, rooms, alerts,
// usage, and webhooks modules.
// ---------------------------------------------------------------------------

// Monitoring / Health
export type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  checkedAt: string;
  message?: string;
}

export interface MonitoringOverview {
  services: ServiceHealth[];
  overallStatus: ServiceStatus;
  checkedAt: string;
}

// Diagnostics
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface DiagnosticEntry {
  id: string;
  severity: DiagnosticSeverity;
  source: string;
  message: string;
  timestamp: string;
  details?: string;
}

// Rooms
export type RoomStatus = "active" | "idle" | "closed" | "error";
export type RoomType = "classroom" | "meeting" | "broadcast" | "webinar";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  status: RoomStatus;
  participants: number;
  maxParticipants: number;
  createdAt: string;
  lastActivityAt: string;
  broadcastActive?: boolean;
}

// Alerts
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  service: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// Usage / Metering
export interface UsageMetrics {
  ticketsToday: number;
  activeUsers: number;
  roomsCreated: number;
  messagesSent: number;
  streamMinutes: number;
  apiRequests: number;
  recordingsCreated: number;
  hlsMinutes: number;
}

// Webhooks
export type WebhookStatus = "active" | "failing" | "disabled";

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: WebhookStatus;
  lastDeliveryAt?: string;
  lastStatusCode?: number;
  failureCount: number;
  createdAt: string;
}

// Dashboard summary
export interface AdminDashboardSummary {
  openTickets: number;
  urgentTickets: number;
  activeRooms: number;
  overallHealth: ServiceStatus;
  activeAlerts: number;
  ticketsToday: number;
  activeUsers: number;
}
