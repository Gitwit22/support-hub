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

const EMPTY_CURRENT_USER: CurrentUser = {
  id: "-",
  name: "-",
  email: "-",
  role: "platform_admin",
  school: "-",
};

const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  openTickets: 0,
  urgentTickets: 0,
  waitingOnUser: 0,
  resolvedToday: 0,
  ticketsByProduct: {},
  recentActivity: [],
};

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
    return EMPTY_CURRENT_USER;
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
    return [];
  }
}

export async function listMyTickets(filters?: TicketFilters): Promise<Ticket[]> {
  try {
    return await supportFetch<Ticket[]>(`/support/tickets/mine${buildQuery(filters)}`);
  } catch {
    return [];
  }
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  try {
    return await supportFetch<Ticket>(`/support/tickets/${encodeURIComponent(ticketId)}`);
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    return undefined;
  }
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return supportFetch<Ticket>("/support/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTicket(ticketId: string, payload: UpdateTicketPayload): Promise<Ticket | undefined> {
  try {
    return await supportFetch<Ticket>(`/support/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    return undefined;
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
    return undefined;
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
    return undefined;
  }
}

export async function submitReportAsTicket(payload: ReportPayload): Promise<Ticket> {
  return supportFetch<Ticket>("/support/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    return await supportFetch<DashboardMetrics>("/support/dashboard");
  } catch {
    return EMPTY_DASHBOARD_METRICS;
  }
}
