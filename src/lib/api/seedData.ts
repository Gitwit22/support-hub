// ---------------------------------------------------------------------------
// Seed / demo data returned when the backend API is unreachable.
// This allows the front-end to render meaningful content even before a
// backend is deployed or when running in preview/demo mode.
// ---------------------------------------------------------------------------

import type {
  Ticket,
  CurrentUser,
  DashboardMetrics,
} from "@/lib/types/support";
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

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

const now = new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const seedCurrentUser: CurrentUser = {
  id: "u-admin",
  name: "Admin User",
  email: "admin@nxtlvl.tech",
  role: "platform_admin",
  school: "District Office",
  schoolId: "school-district",
  tenantId: "tenant-nxtlvl",
};

export const seedTickets: Ticket[] = [
  {
    id: "t-001",
    ticketNumber: "TKT-1001",
    product: "streamline-edu",
    tenantId: "tenant-district1",
    schoolId: "school-lincoln",
    userId: "u-sarah",
    userName: "Sarah Chen",
    userEmail: "sarah.chen@lincoln.edu",
    title: "Projector not displaying in classroom",
    description: "The projector in Room 204 is flickering and does not maintain a stable image when connected via HDMI.",
    category: "troubleshooting",
    priority: "high",
    status: "open",
    source: "web",
    tags: ["hardware", "classroom"],
    assignedToUserId: "u-admin",
    assignedToName: "Admin User",
    createdAt: hoursAgo(4),
    updatedAt: hoursAgo(2),
    messages: [
      {
        id: "m-001",
        ticketId: "t-001",
        authorUserId: "u-sarah",
        authorName: "Sarah Chen",
        authorRole: "teacher",
        type: "reply",
        message: "I've tried two different HDMI cables and the issue persists.",
        createdAt: hoursAgo(3),
      },
    ],
  },
  {
    id: "t-002",
    ticketNumber: "TKT-1002",
    product: "horizon",
    tenantId: "tenant-district1",
    userId: "u-mike",
    userName: "Mike Johnson",
    userEmail: "mike.johnson@district1.edu",
    title: "Unable to join live broadcast",
    description: "Students are reporting a 'Room not found' error when trying to join the scheduled broadcast for period 3.",
    category: "incident",
    priority: "urgent",
    status: "in_progress",
    source: "web",
    tags: ["broadcast", "livekit"],
    assignedToUserId: "u-admin",
    assignedToName: "Admin User",
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(1),
    messages: [
      {
        id: "m-002",
        ticketId: "t-002",
        authorUserId: "u-admin",
        authorName: "Admin User",
        authorRole: "platform_admin",
        type: "reply",
        message: "We're looking into the room provisioning logs now. Will update shortly.",
        createdAt: hoursAgo(1),
      },
    ],
  },
  {
    id: "t-003",
    ticketNumber: "TKT-1003",
    product: "streamline-edu",
    tenantId: "tenant-district1",
    schoolId: "school-jefferson",
    userId: "u-lisa",
    userName: "Lisa Patel",
    userEmail: "lisa.patel@jefferson.edu",
    title: "Password reset not sending email",
    description: "I requested a password reset link 30 minutes ago but haven't received any email. Checked spam folder as well.",
    category: "account_access",
    priority: "medium",
    status: "waiting",
    source: "email",
    tags: ["auth", "email"],
    assignedToUserId: null,
    assignedToName: null,
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(5),
    messages: [],
  },
  {
    id: "t-004",
    ticketNumber: "TKT-1004",
    product: "streamline-corporate",
    tenantId: "tenant-acme",
    userId: "u-james",
    userName: "James Wright",
    userEmail: "james.wright@acme.com",
    title: "Dashboard charts loading slowly",
    description: "The analytics dashboard takes over 10 seconds to load. All other pages are fast.",
    category: "technical",
    priority: "low",
    status: "open",
    source: "web",
    tags: ["performance"],
    assignedToUserId: null,
    assignedToName: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    messages: [],
  },
  {
    id: "t-005",
    ticketNumber: "TKT-1005",
    product: "mejay",
    tenantId: "tenant-district1",
    userId: "u-anna",
    userName: "Anna Kim",
    userEmail: "anna.kim@lincoln.edu",
    title: "Audio playback cutting out during lessons",
    description: "MEJay audio lessons cut out intermittently after about 5 minutes of playback on Chrome.",
    category: "troubleshooting",
    priority: "high",
    status: "open",
    source: "web",
    tags: ["audio", "chrome"],
    assignedToUserId: "u-admin",
    assignedToName: "Admin User",
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(7),
    messages: [],
  },
  {
    id: "t-006",
    ticketNumber: "TKT-1006",
    product: "streamline-edu",
    tenantId: "tenant-district1",
    schoolId: "school-lincoln",
    userId: "u-tom",
    userName: "Tom Rivera",
    userEmail: "tom.rivera@lincoln.edu",
    title: "Student roster not syncing from SIS",
    description: "New students added to PowerSchool yesterday are not appearing in StreamLine class rosters.",
    category: "technical",
    priority: "medium",
    status: "resolved",
    source: "web",
    tags: ["integration", "sis"],
    assignedToUserId: "u-admin",
    assignedToName: "Admin User",
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(3),
    closedAt: hoursAgo(3),
    messages: [
      {
        id: "m-003",
        ticketId: "t-006",
        authorUserId: "u-admin",
        authorName: "Admin User",
        authorRole: "platform_admin",
        type: "reply",
        message: "The SIS sync job was stuck. We've restarted it and the new students should appear within the hour.",
        createdAt: hoursAgo(3),
      },
    ],
  },
];

export const seedDashboardMetrics: DashboardMetrics = {
  openTickets: 4,
  urgentTickets: 1,
  waitingOnUser: 1,
  resolvedToday: 1,
  ticketsByProduct: {
    "streamline-edu": 3,
    horizon: 1,
    "streamline-corporate": 1,
    mejay: 1,
  },
  recentActivity: seedTickets.slice(0, 4),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const seedAdminDashboardSummary: AdminDashboardSummary = {
  openTickets: 4,
  urgentTickets: 1,
  activeRooms: 5,
  overallHealth: "healthy",
  activeAlerts: 2,
  ticketsToday: 3,
  activeUsers: 1_247,
};

export const seedMonitoringOverview: MonitoringOverview = {
  services: [
    { name: "API Gateway", status: "healthy", latencyMs: 42, checkedAt: now, message: "All endpoints responding normally" },
    { name: "Firestore", status: "healthy", latencyMs: 18, checkedAt: now },
    { name: "LiveKit Media", status: "healthy", latencyMs: 35, checkedAt: now },
    { name: "Webhook Relay", status: "degraded", latencyMs: 320, checkedAt: now, message: "Elevated latency detected" },
    { name: "Horizon Streaming", status: "healthy", latencyMs: 28, checkedAt: now },
    { name: "Email Service", status: "healthy", latencyMs: 95, checkedAt: now },
  ],
  overallStatus: "healthy",
  checkedAt: now,
};

export const seedDiagnostics: DiagnosticEntry[] = [
  { id: "d-001", severity: "error", source: "API Gateway", message: "502 Bad Gateway on /api/rooms/join — upstream timeout", timestamp: hoursAgo(1), details: "POST /api/rooms/join returned 502 after 30s timeout. Upstream service did not respond." },
  { id: "d-002", severity: "warning", source: "Webhook Relay", message: "Delivery latency exceeding 300ms threshold", timestamp: hoursAgo(2), details: "Average delivery time: 320ms (threshold: 300ms). 3 webhooks affected." },
  { id: "d-003", severity: "warning", source: "Firestore", message: "Read latency spike on support_tickets collection", timestamp: hoursAgo(4) },
  { id: "d-004", severity: "info", source: "LiveKit", message: "Room auto-cleanup completed — 12 idle rooms removed", timestamp: hoursAgo(6) },
  { id: "d-005", severity: "info", source: "Email Service", message: "Daily digest emails dispatched (847 recipients)", timestamp: hoursAgo(8) },
  { id: "d-006", severity: "error", source: "Horizon Streaming", message: "HLS segment generation failed for room r-104", timestamp: hoursAgo(10), details: "FFmpeg exited with code 1. Input stream closed unexpectedly." },
];

export const seedRooms: Room[] = [
  { id: "r-001", name: "Math 101 — Period 3", type: "classroom", status: "active", participants: 28, maxParticipants: 35, createdAt: daysAgo(30), lastActivityAt: hoursAgo(0.1), broadcastActive: false },
  { id: "r-002", name: "All-Hands Meeting", type: "meeting", status: "active", participants: 14, maxParticipants: 50, createdAt: daysAgo(7), lastActivityAt: hoursAgo(0.2) },
  { id: "r-003", name: "Science Fair Live", type: "broadcast", status: "active", participants: 142, maxParticipants: 500, createdAt: daysAgo(1), lastActivityAt: hoursAgo(0.05), broadcastActive: true },
  { id: "r-004", name: "Staff PD Workshop", type: "webinar", status: "idle", participants: 0, maxParticipants: 100, createdAt: daysAgo(3), lastActivityAt: hoursAgo(2) },
  { id: "r-005", name: "English 201 — Period 5", type: "classroom", status: "active", participants: 22, maxParticipants: 30, createdAt: daysAgo(30), lastActivityAt: hoursAgo(0.3) },
  { id: "r-006", name: "Parent Conference Room", type: "meeting", status: "closed", participants: 0, maxParticipants: 10, createdAt: daysAgo(2), lastActivityAt: daysAgo(1) },
];

export const seedAlerts: Alert[] = [
  { id: "a-001", title: "Webhook delivery failures spiking", severity: "high", status: "active", service: "Webhook Relay", message: "Failure rate exceeded 5% in the last 15 minutes. 3 endpoints affected.", createdAt: hoursAgo(1), updatedAt: hoursAgo(0.5) },
  { id: "a-002", title: "Room join latency elevated", severity: "medium", status: "acknowledged", service: "LiveKit Media", message: "Average room join time is 4.2s (normal: <2s).", createdAt: hoursAgo(3), updatedAt: hoursAgo(2) },
  { id: "a-003", title: "Email delivery delays", severity: "low", status: "resolved", service: "Email Service", message: "SMTP relay queued emails for 12 minutes before delivery.", createdAt: daysAgo(1), updatedAt: hoursAgo(18), resolvedAt: hoursAgo(18) },
  { id: "a-004", title: "Firestore read quota at 80%", severity: "medium", status: "active", service: "Firestore", message: "Daily read quota usage is at 80%. Consider optimizing queries.", createdAt: hoursAgo(5), updatedAt: hoursAgo(4) },
];

export const seedUsageMetrics: UsageMetrics = {
  ticketsToday: 14,
  activeUsers: 1_247,
  roomsCreated: 38,
  messagesSent: 4_812,
  streamMinutes: 2_340,
  apiRequests: 128_450,
  recordingsCreated: 7,
  hlsMinutes: 1_120,
};

export const seedWebhooks: Webhook[] = [
  { id: "wh-001", url: "https://hooks.slack.com/services/T00/B00/xxxx", events: ["ticket.created", "ticket.closed"], status: "active", lastDeliveryAt: hoursAgo(0.5), lastStatusCode: 200, failureCount: 0, createdAt: daysAgo(90) },
  { id: "wh-002", url: "https://api.pagerduty.com/webhooks/v1/events", events: ["alert.triggered"], status: "active", lastDeliveryAt: hoursAgo(1), lastStatusCode: 200, failureCount: 0, createdAt: daysAgo(60) },
  { id: "wh-003", url: "https://analytics.example.com/ingest", events: ["room.created", "room.closed", "broadcast.started"], status: "failing", lastDeliveryAt: hoursAgo(0.25), lastStatusCode: 503, failureCount: 12, createdAt: daysAgo(45) },
  { id: "wh-004", url: "https://old-integration.example.com/hook", events: ["ticket.created"], status: "disabled", failureCount: 0, createdAt: daysAgo(120) },
];

// ---------------------------------------------------------------------------
// Admin Monitoring – granular
// ---------------------------------------------------------------------------

export const seedMonitoringHealthSummary: MonitoringHealthSummary = {
  webhooksActive: 3,
  webhooksFailing: 1,
  activeRooms: 5,
  pendingSupportTickets: 4,
  overallStatus: "healthy",
  checkedAt: now,
};

export const seedMonitoringServiceStatus: MonitoringServiceStatus = {
  services: [
    { name: "API", status: "healthy", latencyMs: 12, checkedAt: now },
    { name: "Firestore", status: "healthy", latencyMs: 18, checkedAt: now },
    { name: "LiveKit", status: "healthy", latencyMs: 35, checkedAt: now },
    { name: "Webhook Relay", status: "degraded", latencyMs: 320, checkedAt: now, message: "Elevated latency" },
    { name: "Horizon", status: "healthy", latencyMs: 28, checkedAt: now },
  ],
  checkedAt: now,
};

export const seedWebhookDeliveryLog: WebhookDeliveryLog = {
  deliveries: [
    { id: "del-1", webhookId: "wh-001", eventId: "evt-101", eventName: "ticket.created", url: "https://hooks.slack.com/services/T00/B00/xxxx", status: "success", statusCode: 200, attempt: 1, createdAt: hoursAgo(0.5), completedAt: hoursAgo(0.5) },
    { id: "del-2", webhookId: "wh-003", eventId: "evt-102", eventName: "room.created", url: "https://analytics.example.com/ingest", status: "failed", statusCode: 503, attempt: 3, createdAt: hoursAgo(0.25), completedAt: hoursAgo(0.25), error: "Service Unavailable" },
    { id: "del-3", webhookId: "wh-002", eventId: "evt-100", eventName: "alert.triggered", url: "https://api.pagerduty.com/webhooks/v1/events", status: "success", statusCode: 200, attempt: 1, createdAt: hoursAgo(1), completedAt: hoursAgo(1) },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

export const seedActiveRooms: ActiveRoom[] = [
  { id: "r-001", name: "Math 101 — Period 3", type: "classroom", participants: 28, startedAt: hoursAgo(1), lastActivityAt: hoursAgo(0.1) },
  { id: "r-002", name: "All-Hands Meeting", type: "meeting", participants: 14, startedAt: hoursAgo(0.5), lastActivityAt: hoursAgo(0.2) },
  { id: "r-003", name: "Science Fair Live", type: "broadcast", participants: 142, startedAt: hoursAgo(2), lastActivityAt: hoursAgo(0.05) },
  { id: "r-005", name: "English 201 — Period 5", type: "classroom", participants: 22, startedAt: hoursAgo(1.5), lastActivityAt: hoursAgo(0.3) },
];

export const seedAdminSupportTickets: AdminSupportTicket[] = [
  { id: "t-001", ticketNumber: "TKT-1001", title: "Projector not displaying in classroom", status: "open", priority: "high", assignedTo: "Admin User", createdAt: hoursAgo(4), updatedAt: hoursAgo(2) },
  { id: "t-002", ticketNumber: "TKT-1002", title: "Unable to join live broadcast", status: "in_progress", priority: "urgent", assignedTo: "Admin User", createdAt: hoursAgo(2), updatedAt: hoursAgo(1) },
  { id: "t-003", ticketNumber: "TKT-1003", title: "Password reset not sending email", status: "waiting", priority: "medium", createdAt: hoursAgo(6), updatedAt: hoursAgo(5) },
];
