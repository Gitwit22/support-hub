import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listTickets,
  listMyTickets,
  getTicket,
  createTicket,
  closeTicket,
  getCurrentUser,
  listDashboardMetrics,
} from "./support";

// ---------------------------------------------------------------------------
// When the backend is unreachable, read paths should return empty-safe values
// and writes should not fabricate mock data.
// ---------------------------------------------------------------------------

describe("support API – empty fallback", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  });

  it("getCurrentUser returns blank-safe user on network error", async () => {
    const result = await getCurrentUser();
    expect(result.id).toBe("-");
    expect(result.name).toBe("-");
  });

  it("listTickets returns empty array on network error", async () => {
    const result = await listTickets();
    expect(result).toEqual([]);
  });

  it("listMyTickets returns empty array on network error", async () => {
    const result = await listMyTickets();
    expect(result).toEqual([]);
  });

  it("getTicket returns undefined on network error", async () => {
    const result = await getTicket("any-id");
    expect(result).toBeUndefined();
  });

  it("getTicket returns undefined for unknown id on network error", async () => {
    const result = await getTicket("non-existent");
    expect(result).toBeUndefined();
  });

  it("createTicket rejects on network error", async () => {
    await expect(createTicket({
      title: "Test ticket",
      description: "A test description",
      category: "technical",
      priority: "medium",
    })).rejects.toThrow();
  });

  it("closeTicket returns undefined on network error", async () => {
    const result = await closeTicket("t-001");
    expect(result).toBeUndefined();
  });

  it("listDashboardMetrics returns empty metrics on network error", async () => {
    const result = await listDashboardMetrics();
    expect(result).toEqual({
      openTickets: 0,
      urgentTickets: 0,
      waitingOnUser: 0,
      resolvedToday: 0,
      ticketsByProduct: {},
      recentActivity: [],
    });
  });
});
