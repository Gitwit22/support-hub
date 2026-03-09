import type {
  Ticket, TicketFilters, CreateTicketPayload, UpdateTicketPayload,
  AddMessagePayload, ReportPayload, TicketMessage, CurrentUser,
  DashboardMetrics,
} from "@/lib/types/support";
import { apiFetch, ApiError } from "./client";

// ---------------------------------------------------------------------------
// Auth — user identity is managed server-side via session / token.
// setCurrentUserKey is a no-op retained for backward compatibility.
// ---------------------------------------------------------------------------

/** @deprecated User context is now managed server-side. */
export const setCurrentUserKey = (_key: string) => { /* no-op */ };

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/support/me");
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
  return apiFetch<Ticket[]>(`/support/tickets${buildQuery(filters)}`);
}

export async function listMyTickets(filters?: TicketFilters): Promise<Ticket[]> {
  return apiFetch<Ticket[]>(`/support/tickets/mine${buildQuery(filters)}`);
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  try {
    return await apiFetch<Ticket>(`/support/tickets/${encodeURIComponent(ticketId)}`);
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return apiFetch<Ticket>("/support/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTicket(ticketId: string, payload: UpdateTicketPayload): Promise<Ticket | undefined> {
  try {
    return await apiFetch<Ticket>(`/support/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

export async function addTicketMessage(ticketId: string, payload: AddMessagePayload): Promise<TicketMessage | undefined> {
  try {
    return await apiFetch<TicketMessage>(
      `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

export async function closeTicket(ticketId: string): Promise<Ticket | undefined> {
  try {
    return await apiFetch<Ticket>(
      `/support/tickets/${encodeURIComponent(ticketId)}/close`,
      { method: "POST" },
    );
  } catch (err: unknown) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

export async function submitReportAsTicket(payload: ReportPayload): Promise<Ticket> {
  return apiFetch<Ticket>("/support/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>("/support/dashboard");
}
