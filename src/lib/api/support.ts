import type {
  Ticket, TicketFilters, CreateTicketPayload, UpdateTicketPayload,
  AddMessagePayload, ReportPayload, TicketMessage, CurrentUser,
  DashboardMetrics,
} from "@/lib/types/support";
import {
  apiFetch,
  ApiError,
  isStreamlineSupportEnabled,
  streamlineFetch,
} from "./client";
import {
  seedCurrentUser,
  seedTickets,
  seedDashboardMetrics,
} from "./seedData";

// ---------------------------------------------------------------------------
// Auth — user identity is managed server-side via session / token.
// setCurrentUserKey is a no-op retained for backward compatibility.
// ---------------------------------------------------------------------------

/** @deprecated User context is now managed server-side. */
export const setCurrentUserKey = (_key: string) => { /* no-op */ };

async function supportFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (isStreamlineSupportEnabled()) {
    return streamlineFetch<T>(path, options);
  }
  return apiFetch<T>(path, options);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    return await supportFetch<CurrentUser>("/support/me");
  } catch {
    return seedCurrentUser;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQuery(filters?: TicketFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.category) params.set("category", filters.category);
  if (filters.product) params.set("product", filters.product);
  if (filters.tenantId) params.set("tenantId", filters.tenantId);
  if (filters.schoolId) params.set("schoolId", filters.schoolId);
  if (filters.orgId) params.set("orgId", filters.orgId);
  if (filters.assignedToUserId) params.set("assignedToUserId", filters.assignedToUserId);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

// ---------------------------------------------------------------------------
// Ticket API
// ---------------------------------------------------------------------------

export async function listTickets(filters?: TicketFilters): Promise<Ticket[]> {
  try {
    return await supportFetch<Ticket[]>(`/support/tickets${buildQuery(filters)}`);
  } catch {
    return seedTickets;
  }
}

export async function listMyTickets(filters?: TicketFilters): Promise<Ticket[]> {
  try {
    return await supportFetch<Ticket[]>(`/support/tickets/mine${buildQuery(filters)}`);
  } catch {
    return seedTickets;
  }
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  try {
    return await supportFetch<Ticket>(`/support/tickets/${encodeURIComponent(ticketId)}`);
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    return seedTickets.find((t) => t.id === ticketId);
  }
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  try {
    return await supportFetch<Ticket>("/support/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      id: `t-${Date.now()}`,
      ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      product: payload.product ?? "streamline-edu",
      userId: seedCurrentUser.id,
      userName: seedCurrentUser.name,
      userEmail: seedCurrentUser.email,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
      status: "open",
      source: "web",
      tags: payload.tags ?? [],
      assignedToUserId: null,
      assignedToName: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
  }
}

export async function updateTicket(ticketId: string, payload: UpdateTicketPayload): Promise<Ticket | undefined> {
  try {
    return await supportFetch<Ticket>(`/support/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    const ticket = seedTickets.find((t) => t.id === ticketId);
    if (!ticket) return undefined;
    return { ...ticket, ...payload, updatedAt: new Date().toISOString() };
  }
}

export async function addTicketMessage(ticketId: string, payload: AddMessagePayload): Promise<TicketMessage | undefined> {
  try {
    return await supportFetch<TicketMessage>(
      `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    const msg: TicketMessage = {
      id: `m-${Date.now()}`,
      ticketId,
      authorUserId: seedCurrentUser.id,
      authorName: seedCurrentUser.name,
      authorRole: seedCurrentUser.role,
      type: payload.type ?? "reply",
      message: payload.message,
      createdAt: new Date().toISOString(),
    };
    return msg;
  }
}

export async function closeTicket(ticketId: string): Promise<Ticket | undefined> {
  try {
    return await supportFetch<Ticket>(
      `/support/tickets/${encodeURIComponent(ticketId)}/close`,
      { method: "POST" },
    );
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    const ticket = seedTickets.find((t) => t.id === ticketId);
    if (!ticket) return undefined;
    const now = new Date().toISOString();
    return { ...ticket, status: "closed" as const, closedAt: now, updatedAt: now };
  }
}

export async function submitReportAsTicket(payload: ReportPayload): Promise<Ticket> {
  try {
    return await supportFetch<Ticket>("/support/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      id: `t-${Date.now()}`,
      ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      product: "streamline-edu",
      userId: seedCurrentUser.id,
      userName: seedCurrentUser.name,
      userEmail: seedCurrentUser.email,
      title: payload.title,
      description: payload.description,
      category: "incident",
      priority: payload.severity === "critical" ? "urgent" : payload.severity === "high" ? "high" : "medium",
      status: "open",
      source: "report",
      tags: payload.tags ?? [],
      assignedToUserId: null,
      assignedToName: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
  }
}

export async function listDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    return await supportFetch<DashboardMetrics>("/support/dashboard");
  } catch {
    return seedDashboardMetrics;
  }
}
