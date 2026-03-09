import type {
  Ticket, TicketFilters, CreateTicketPayload, UpdateTicketPayload,
  AddMessagePayload, ReportPayload, TicketMessage, CurrentUser,
  DashboardMetrics, SupportProduct,
} from "@/lib/types/support";

// ---------------------------------------------------------------------------
// Mock current user — in production this comes from auth
// ---------------------------------------------------------------------------
const MOCK_USERS: Record<string, CurrentUser> = {
  teacher: {
    id: "u1", name: "Sarah Chen", email: "sarah.chen@lincoln.edu",
    role: "teacher", school: "Lincoln Elementary", schoolId: "school-lincoln", tenantId: "tenant-district1",
  },
  admin: {
    id: "u-admin", name: "Admin User", email: "admin@nxtlvl.tech",
    role: "platform_admin", school: "District Office", schoolId: "school-district", tenantId: "tenant-nxtlvl",
  },
};

let currentUserKey = "teacher";
export const setCurrentUserKey = (key: string) => { currentUserKey = key; };
export const getCurrentUser = (): CurrentUser => MOCK_USERS[currentUserKey] || MOCK_USERS.teacher;

// ---------------------------------------------------------------------------
// Mock data store — product-aware
// ---------------------------------------------------------------------------
const tickets: Ticket[] = [
  {
    id: "t-001", ticketNumber: "TKT-001", product: "streamline-edu",
    tenantId: "tenant-district1", schoolId: "school-lincoln",
    userId: "u1", userName: "Sarah Chen", userEmail: "sarah.chen@lincoln.edu",
    title: "Projector not working in Room 204",
    description: "The ceiling projector in Room 204 has been showing a flickering image since Monday. Tried restarting it but the issue persists.",
    category: "troubleshooting", priority: "high", status: "open",
    source: "web", tags: ["hardware", "room-204"],
    assignedToUserId: null, assignedToName: null,
    messages: [
      {
        id: "m1", ticketId: "t-001", authorUserId: "u1", authorName: "Sarah Chen",
        authorRole: "teacher", type: "reply",
        message: "The projector flickers every 30 seconds approximately. Students can't read the slides.",
        createdAt: "2026-03-08T10:00:00Z",
      },
    ],
    createdAt: "2026-03-08T09:30:00Z", updatedAt: "2026-03-08T10:00:00Z",
    lastReplyAt: "2026-03-08T10:00:00Z", lastReplyBy: "Sarah Chen",
  },
  {
    id: "t-002", ticketNumber: "TKT-002", product: "streamline-edu",
    tenantId: "tenant-district1", schoolId: "school-lincoln",
    userId: "u1", userName: "Sarah Chen", userEmail: "sarah.chen@lincoln.edu",
    title: "Can't access student gradebook",
    description: "Getting a 403 error when trying to view the gradebook for my 3rd period class.",
    category: "account_access", priority: "medium", status: "in_progress",
    source: "web", tags: ["access", "gradebook"],
    assignedToUserId: "u-admin", assignedToName: "Tech Support",
    messages: [
      {
        id: "m2", ticketId: "t-002", authorUserId: "u1", authorName: "Sarah Chen",
        authorRole: "teacher", type: "reply",
        message: "I've been locked out since this morning.", createdAt: "2026-03-07T14:00:00Z",
      },
      {
        id: "m3", ticketId: "t-002", authorUserId: "u-admin", authorName: "Admin User",
        authorRole: "platform_admin", type: "reply",
        message: "We're looking into the permissions issue. Should be resolved within the hour.",
        createdAt: "2026-03-07T15:30:00Z",
      },
      {
        id: "m4", ticketId: "t-002", authorUserId: "u-admin", authorName: "Admin User",
        authorRole: "platform_admin", type: "internal_note",
        message: "Permissions cache issue. Need to flush for this school.",
        createdAt: "2026-03-07T15:35:00Z",
      },
    ],
    createdAt: "2026-03-07T13:45:00Z", updatedAt: "2026-03-07T15:35:00Z",
    lastReplyAt: "2026-03-07T15:30:00Z", lastReplyBy: "Admin User",
  },
  {
    id: "t-003", ticketNumber: "TKT-003", product: "streamline-edu",
    tenantId: "tenant-district1", schoolId: "school-washington",
    userId: "u2", userName: "James Rodriguez", userEmail: "j.rodriguez@washington.edu",
    title: "Incident report: Water leak in science lab",
    description: "A pipe burst in the science lab during 2nd period. No injuries but equipment may be damaged.",
    category: "incident", priority: "urgent", status: "open",
    source: "web", tags: ["incident", "facilities", "science-lab"],
    assignedToUserId: null, assignedToName: null,
    messages: [],
    createdAt: "2026-03-09T08:15:00Z", updatedAt: "2026-03-09T08:15:00Z",
  },
  {
    id: "t-004", ticketNumber: "TKT-004", product: "streamline-edu",
    tenantId: "tenant-district1", schoolId: "school-lincoln",
    userId: "u1", userName: "Sarah Chen", userEmail: "sarah.chen@lincoln.edu",
    title: "Request for new software license",
    description: "Need Adobe Creative Suite licenses for the art department's new semester curriculum.",
    category: "help_request", priority: "low", status: "resolved",
    source: "web", tags: ["software", "license"],
    assignedToUserId: "u-admin", assignedToName: "IT Admin",
    messages: [
      {
        id: "m5", ticketId: "t-004", authorUserId: "u-admin", authorName: "Admin User",
        authorRole: "platform_admin", type: "reply",
        message: "Licenses have been provisioned. Please restart your workstation.",
        createdAt: "2026-03-06T11:00:00Z",
      },
    ],
    createdAt: "2026-03-05T09:00:00Z", updatedAt: "2026-03-06T11:00:00Z",
    lastReplyAt: "2026-03-06T11:00:00Z", lastReplyBy: "Admin User",
  },
  {
    id: "t-005", ticketNumber: "TKT-005", product: "horizon",
    tenantId: "tenant-nxtlvl", orgId: "org-media-co",
    userId: "u3", userName: "Alex Rivera", userEmail: "alex@mediaco.com",
    title: "Dashboard widgets not loading",
    description: "The analytics dashboard widgets show a spinner indefinitely after the latest update.",
    category: "technical", priority: "high", status: "open",
    source: "web", tags: ["dashboard", "widgets", "loading"],
    assignedToUserId: null, assignedToName: null,
    messages: [
      {
        id: "m6", ticketId: "t-005", authorUserId: "u3", authorName: "Alex Rivera",
        authorRole: "teacher", type: "reply",
        message: "Tried clearing cache and different browsers — same issue.",
        createdAt: "2026-03-09T11:00:00Z",
      },
    ],
    createdAt: "2026-03-09T10:30:00Z", updatedAt: "2026-03-09T11:00:00Z",
    lastReplyAt: "2026-03-09T11:00:00Z", lastReplyBy: "Alex Rivera",
  },
  {
    id: "t-006", ticketNumber: "TKT-006", product: "mejay",
    tenantId: "tenant-nxtlvl",
    userId: "u4", userName: "Jordan Lee", userEmail: "jordan@mejayapp.com",
    title: "Audio sync issues during live mixing",
    description: "There's a noticeable delay (~200ms) between audio inputs when using the live mixing feature.",
    category: "troubleshooting", priority: "urgent", status: "waiting",
    source: "api", tags: ["audio", "latency", "live-mixing"],
    assignedToUserId: "u-admin", assignedToName: "Admin User",
    messages: [
      {
        id: "m7", ticketId: "t-006", authorUserId: "u4", authorName: "Jordan Lee",
        authorRole: "teacher", type: "reply",
        message: "Happens on both Chrome and Firefox. Using a Focusrite Scarlett 2i2 interface.",
        createdAt: "2026-03-09T09:00:00Z",
      },
      {
        id: "m8", ticketId: "t-006", authorUserId: "u-admin", authorName: "Admin User",
        authorRole: "platform_admin", type: "internal_note",
        message: "Known WebAudio API issue with certain buffer sizes. Needs engineering escalation.",
        createdAt: "2026-03-09T10:00:00Z",
      },
    ],
    createdAt: "2026-03-09T08:30:00Z", updatedAt: "2026-03-09T10:00:00Z",
    lastReplyAt: "2026-03-09T09:00:00Z", lastReplyBy: "Jordan Lee",
  },
];

let nextTicketNum = 7;
const generateId = () => `t-${String(nextTicketNum).padStart(3, "0")}`;
const generateTicketNumber = () => `TKT-${String(nextTicketNum++).padStart(3, "0")}`;

// Simulated delay
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Shared API functions
// ---------------------------------------------------------------------------

export async function listTickets(filters?: TicketFilters): Promise<Ticket[]> {
  await delay();
  let result = [...tickets];
  if (filters?.status) result = result.filter(t => t.status === filters.status);
  if (filters?.priority) result = result.filter(t => t.priority === filters.priority);
  if (filters?.category) result = result.filter(t => t.category === filters.category);
  if (filters?.product) result = result.filter(t => t.product === filters.product);
  if (filters?.tenantId) result = result.filter(t => t.tenantId === filters.tenantId);
  if (filters?.schoolId) result = result.filter(t => t.schoolId === filters.schoolId);
  if (filters?.orgId) result = result.filter(t => t.orgId === filters.orgId);
  if (filters?.assignedToUserId) result = result.filter(t => t.assignedToUserId === filters.assignedToUserId);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      (t.userEmail && t.userEmail.toLowerCase().includes(q)),
    );
  }
  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function listMyTickets(filters?: TicketFilters): Promise<Ticket[]> {
  const user = getCurrentUser();
  const all = await listTickets(filters);
  if (user.role === "platform_admin") return all;
  if (user.role === "school_admin" || user.role === "principal") {
    return all.filter(t => t.schoolId === user.schoolId || t.tenantId === user.tenantId);
  }
  return all.filter(t => t.userId === user.id);
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  await delay(200);
  const user = getCurrentUser();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return undefined;
  // Filter internal notes for non-admin users
  if (user.role !== "platform_admin" && user.role !== "school_admin") {
    return { ...ticket, messages: ticket.messages.filter(m => m.type !== "internal_note") };
  }
  return ticket;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  await delay(400);
  const user = getCurrentUser();
  const now = new Date().toISOString();
  const id = generateId();
  const ticketNumber = generateTicketNumber();
  const ticket: Ticket = {
    id,
    ticketNumber,
    product: payload.product || "streamline-edu",
    tenantId: user.tenantId,
    orgId: user.orgId,
    schoolId: user.schoolId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    priority: payload.priority,
    status: "open",
    source: "web",
    tags: payload.tags || [],
    assignedToUserId: null,
    assignedToName: null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  tickets.unshift(ticket);
  return ticket;
}

export async function updateTicket(ticketId: string, payload: UpdateTicketPayload): Promise<Ticket | undefined> {
  await delay(300);
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return undefined;
  const now = new Date().toISOString();
  const updates: Partial<Ticket> = { ...payload, updatedAt: now };
  if (payload.status === "closed") updates.closedAt = now;
  tickets[idx] = { ...tickets[idx], ...updates };
  return tickets[idx];
}

export async function addTicketMessage(ticketId: string, payload: AddMessagePayload): Promise<TicketMessage | undefined> {
  await delay(300);
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return undefined;
  const user = getCurrentUser();
  const now = new Date().toISOString();
  const msg: TicketMessage = {
    id: `m-${Date.now()}`,
    ticketId,
    authorUserId: user.id,
    authorName: user.name,
    authorRole: user.role,
    type: payload.type || "reply",
    message: payload.message,
    createdAt: now,
  };
  ticket.messages.push(msg);
  ticket.updatedAt = now;
  if (msg.type === "reply") {
    ticket.lastReplyAt = now;
    ticket.lastReplyBy = user.name;
  }
  return msg;
}

export async function closeTicket(ticketId: string): Promise<Ticket | undefined> {
  return updateTicket(ticketId, { status: "closed" });
}

export async function submitReportAsTicket(payload: ReportPayload): Promise<Ticket> {
  const priorityMap: Record<string, "low" | "medium" | "high" | "urgent"> = {
    low: "low", medium: "medium", high: "high", critical: "urgent",
  };
  return createTicket({
    title: payload.title,
    description: payload.description,
    category: payload.reportType === "incident" ? "incident" : payload.reportType === "behavior" ? "behavior" : "other",
    priority: priorityMap[payload.severity] || "medium",
    tags: [...(payload.tags || []), `report:${payload.reportType}`, ...(payload.relatedEntity ? [`ref:${payload.relatedEntity}`] : [])],
  });
}

export async function listDashboardMetrics(): Promise<DashboardMetrics> {
  await delay(200);
  const today = new Date().toISOString().slice(0, 10);
  const openTickets = tickets.filter(t => t.status === "open").length;
  const urgentTickets = tickets.filter(t => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length;
  const waitingOnUser = tickets.filter(t => t.status === "waiting").length;
  const resolvedToday = tickets.filter(t =>
    (t.status === "resolved" || t.status === "closed") && t.updatedAt.slice(0, 10) === today,
  ).length;

  const ticketsByProduct: Record<string, number> = {};
  for (const t of tickets) {
    ticketsByProduct[t.product] = (ticketsByProduct[t.product] || 0) + 1;
  }

  const recentActivity = [...tickets]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return { openTickets, urgentTickets, waitingOnUser, resolvedToday, ticketsByProduct, recentActivity };
}
