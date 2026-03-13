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
import {
  seedTickets,
  seedCurrentUser,
  seedDashboardMetrics,
} from "./seedData";

// ---------------------------------------------------------------------------
// When the backend is unreachable every API function should return seed data
// instead of throwing.
// ---------------------------------------------------------------------------

describe("support API – seed data fallback", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  });

  it("getCurrentUser returns seed user on network error", async () => {
    const result = await getCurrentUser();
    expect(result).toEqual(seedCurrentUser);
  });

  it("listTickets returns seed tickets on network error", async () => {
    const result = await listTickets();
    expect(result).toEqual(seedTickets);
  });

  it("listMyTickets returns seed tickets on network error", async () => {
    const result = await listMyTickets();
    expect(result).toEqual(seedTickets);
  });

  it("getTicket returns matching seed ticket on network error", async () => {
    const result = await getTicket("t-001");
    expect(result).toBeDefined();
    expect(result?.id).toBe("t-001");
  });

  it("getTicket returns undefined for unknown id on network error", async () => {
    const result = await getTicket("non-existent");
    expect(result).toBeUndefined();
  });

  it("createTicket returns a new ticket on network error", async () => {
    const result = await createTicket({
      title: "Test ticket",
      description: "A test description",
      category: "technical",
      priority: "medium",
    });
    expect(result.title).toBe("Test ticket");
    expect(result.status).toBe("open");
    expect(result.id).toBeTruthy();
  });

  it("closeTicket updates seed ticket on network error", async () => {
    const result = await closeTicket("t-001");
    expect(result).toBeDefined();
    expect(result?.status).toBe("closed");
    expect(result?.closedAt).toBeTruthy();
  });

  it("listDashboardMetrics returns seed metrics on network error", async () => {
    const result = await listDashboardMetrics();
    expect(result).toEqual(seedDashboardMetrics);
  });
});
