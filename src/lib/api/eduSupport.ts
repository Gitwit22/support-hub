import type {
  Ticket, TicketFilters, CreateTicketPayload, UpdateTicketPayload,
  AddMessagePayload, ReportPayload, TicketMessage, CurrentUser
} from "@/lib/types/support";

// Mock current user - in production this comes from auth
const MOCK_USERS: Record<string, CurrentUser> = {
  teacher: { id: "u1", name: "Sarah Chen", role: "teacher", school: "Lincoln Elementary" },
  admin: { id: "u-admin", name: "Admin User", role: "platform_admin", school: "District Office" },
};

let currentUserKey = "teacher";
export const setCurrentUserKey = (key: string) => { currentUserKey = key; };
export const getCurrentUser = (): CurrentUser => MOCK_USERS[currentUserKey] || MOCK_USERS.teacher;

// Mock data store
let tickets: Ticket[] = [
  {
    id: "TKT-001", title: "Projector not working in Room 204",
    description: "The ceiling projector in Room 204 has been showing a flickering image since Monday. Tried restarting it but the issue persists.",
    school: "Lincoln Elementary", submittedBy: "Sarah Chen", submittedById: "u1", submittedByRole: "teacher",
    category: "troubleshooting", priority: "high", status: "open", assignedTo: null,
    tags: ["hardware", "room-204"],
    messages: [
      { id: "m1", ticketId: "TKT-001", authorId: "u1", authorName: "Sarah Chen", authorRole: "teacher", content: "The projector flickers every 30 seconds approximately. Students can't read the slides.", isInternalNote: false, createdAt: "2026-03-08T10:00:00Z" },
    ],
    createdAt: "2026-03-08T09:30:00Z", updatedAt: "2026-03-08T10:00:00Z",
  },
  {
    id: "TKT-002", title: "Can't access student gradebook",
    description: "Getting a 403 error when trying to view the gradebook for my 3rd period class.",
    school: "Lincoln Elementary", submittedBy: "Sarah Chen", submittedById: "u1", submittedByRole: "teacher",
    category: "account_access", priority: "medium", status: "in_progress", assignedTo: "Tech Support",
    tags: ["access", "gradebook"],
    messages: [
      { id: "m2", ticketId: "TKT-002", authorId: "u1", authorName: "Sarah Chen", authorRole: "teacher", content: "I've been locked out since this morning.", isInternalNote: false, createdAt: "2026-03-07T14:00:00Z" },
      { id: "m3", ticketId: "TKT-002", authorId: "u-admin", authorName: "Admin User", authorRole: "platform_admin", content: "We're looking into the permissions issue. Should be resolved within the hour.", isInternalNote: false, createdAt: "2026-03-07T15:30:00Z" },
      { id: "m4", ticketId: "TKT-002", authorId: "u-admin", authorName: "Admin User", authorRole: "platform_admin", content: "Permissions cache issue. Need to flush for this school.", isInternalNote: true, createdAt: "2026-03-07T15:35:00Z" },
    ],
    createdAt: "2026-03-07T13:45:00Z", updatedAt: "2026-03-07T15:35:00Z",
  },
  {
    id: "TKT-003", title: "Incident report: Water leak in science lab",
    description: "A pipe burst in the science lab during 2nd period. No injuries but equipment may be damaged.",
    school: "Washington Middle School", submittedBy: "James Rodriguez", submittedById: "u2", submittedByRole: "teacher",
    category: "incident", priority: "urgent", status: "open", assignedTo: null,
    tags: ["incident", "facilities", "science-lab"],
    messages: [],
    createdAt: "2026-03-09T08:15:00Z", updatedAt: "2026-03-09T08:15:00Z",
  },
  {
    id: "TKT-004", title: "Request for new software license",
    description: "Need Adobe Creative Suite licenses for the art department's new semester curriculum.",
    school: "Lincoln Elementary", submittedBy: "Sarah Chen", submittedById: "u1", submittedByRole: "teacher",
    category: "help_request", priority: "low", status: "resolved", assignedTo: "IT Admin",
    tags: ["software", "license"],
    messages: [
      { id: "m5", ticketId: "TKT-004", authorId: "u-admin", authorName: "Admin User", authorRole: "platform_admin", content: "Licenses have been provisioned. Please restart your workstation.", isInternalNote: false, createdAt: "2026-03-06T11:00:00Z" },
    ],
    createdAt: "2026-03-05T09:00:00Z", updatedAt: "2026-03-06T11:00:00Z",
  },
];

let nextTicketNum = 5;
const generateId = () => `TKT-${String(nextTicketNum++).padStart(3, "0")}`;

// Simulated delay
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export async function listTickets(filters?: TicketFilters): Promise<Ticket[]> {
  await delay();
  let result = [...tickets];
  if (filters?.status) result = result.filter(t => t.status === filters.status);
  if (filters?.priority) result = result.filter(t => t.priority === filters.priority);
  if (filters?.category) result = result.filter(t => t.category === filters.category);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }
  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function listMyTickets(filters?: TicketFilters): Promise<Ticket[]> {
  const user = getCurrentUser();
  const all = await listTickets(filters);
  if (user.role === "platform_admin") return all;
  if (user.role === "school_admin" || user.role === "principal") return all.filter(t => t.school === user.school);
  return all.filter(t => t.submittedById === user.id);
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  await delay(200);
  const user = getCurrentUser();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return undefined;
  // Filter internal notes for non-admin users
  if (user.role !== "platform_admin" && user.role !== "school_admin") {
    return { ...ticket, messages: ticket.messages.filter(m => !m.isInternalNote) };
  }
  return ticket;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  await delay(400);
  const user = getCurrentUser();
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: generateId(), ...payload,
    description: payload.description,
    school: user.school, submittedBy: user.name, submittedById: user.id, submittedByRole: user.role,
    status: "open", assignedTo: null, tags: payload.tags || [],
    messages: [], createdAt: now, updatedAt: now,
  };
  tickets.unshift(ticket);
  return ticket;
}

export async function updateTicket(ticketId: string, payload: UpdateTicketPayload): Promise<Ticket | undefined> {
  await delay(300);
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return undefined;
  tickets[idx] = { ...tickets[idx], ...payload, updatedAt: new Date().toISOString() };
  return tickets[idx];
}

export async function addTicketMessage(ticketId: string, payload: AddMessagePayload): Promise<TicketMessage | undefined> {
  await delay(300);
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return undefined;
  const user = getCurrentUser();
  const msg: TicketMessage = {
    id: `m-${Date.now()}`, ticketId, authorId: user.id, authorName: user.name, authorRole: user.role,
    content: payload.content, isInternalNote: payload.isInternalNote || false,
    createdAt: new Date().toISOString(),
  };
  ticket.messages.push(msg);
  ticket.updatedAt = msg.createdAt;
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
