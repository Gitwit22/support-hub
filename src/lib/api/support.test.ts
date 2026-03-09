import { describe, it, expect, beforeEach } from "vitest";
import {
  listTickets,
  listMyTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketMessage,
  closeTicket,
  listDashboardMetrics,
  setCurrentUserKey,
  getCurrentUser,
} from "@/lib/api/support";
import type { TicketFilters } from "@/lib/types/support";

describe("shared support API", () => {
  beforeEach(() => {
    setCurrentUserKey("admin");
  });

  describe("listTickets", () => {
    it("returns all tickets without filters", async () => {
      const tickets = await listTickets();
      expect(tickets.length).toBeGreaterThanOrEqual(6);
      expect(tickets[0].updatedAt >= tickets[tickets.length - 1].updatedAt).toBe(true);
    });

    it("filters by product", async () => {
      const filters: TicketFilters = { product: "horizon" };
      const tickets = await listTickets(filters);
      expect(tickets.every(t => t.product === "horizon")).toBe(true);
    });

    it("filters by status", async () => {
      const filters: TicketFilters = { status: "open" };
      const tickets = await listTickets(filters);
      expect(tickets.every(t => t.status === "open")).toBe(true);
    });

    it("filters by priority", async () => {
      const filters: TicketFilters = { priority: "urgent" };
      const tickets = await listTickets(filters);
      expect(tickets.every(t => t.priority === "urgent")).toBe(true);
    });

    it("searches by ticket number", async () => {
      const filters: TicketFilters = { search: "TKT-001" };
      const tickets = await listTickets(filters);
      expect(tickets.some(t => t.ticketNumber === "TKT-001")).toBe(true);
    });

    it("searches by user name", async () => {
      const filters: TicketFilters = { search: "Jordan" };
      const tickets = await listTickets(filters);
      expect(tickets.some(t => t.userName.includes("Jordan"))).toBe(true);
    });
  });

  describe("listMyTickets", () => {
    it("returns all tickets for platform admin", async () => {
      setCurrentUserKey("admin");
      const all = await listTickets();
      const my = await listMyTickets();
      expect(my.length).toBe(all.length);
    });

    it("returns only user tickets for teacher", async () => {
      setCurrentUserKey("teacher");
      const my = await listMyTickets();
      const user = getCurrentUser();
      expect(my.every(t => t.userId === user.id)).toBe(true);
    });
  });

  describe("getTicket", () => {
    it("returns ticket by id", async () => {
      const ticket = await getTicket("t-001");
      expect(ticket).toBeDefined();
      expect(ticket!.ticketNumber).toBe("TKT-001");
      expect(ticket!.product).toBe("streamline-edu");
    });

    it("returns undefined for non-existent ticket", async () => {
      const ticket = await getTicket("non-existent");
      expect(ticket).toBeUndefined();
    });

    it("filters internal notes for non-admin users", async () => {
      setCurrentUserKey("teacher");
      const ticket = await getTicket("t-002");
      expect(ticket).toBeDefined();
      expect(ticket!.messages.every(m => m.type !== "internal_note")).toBe(true);
    });

    it("shows internal notes for admin users", async () => {
      setCurrentUserKey("admin");
      const ticket = await getTicket("t-002");
      expect(ticket).toBeDefined();
      expect(ticket!.messages.some(m => m.type === "internal_note")).toBe(true);
    });
  });

  describe("createTicket", () => {
    it("creates a ticket with product metadata", async () => {
      setCurrentUserKey("admin");
      const ticket = await createTicket({
        title: "Test ticket",
        description: "Test description",
        category: "technical",
        priority: "medium",
        product: "horizon",
      });
      expect(ticket.product).toBe("horizon");
      expect(ticket.ticketNumber).toMatch(/^TKT-/);
      expect(ticket.status).toBe("open");
      expect(ticket.userId).toBe(getCurrentUser().id);
      expect(ticket.userName).toBe(getCurrentUser().name);
    });

    it("defaults to streamline-edu if no product specified", async () => {
      const ticket = await createTicket({
        title: "Default product test",
        description: "Test",
        category: "help_request",
        priority: "low",
      });
      expect(ticket.product).toBe("streamline-edu");
    });
  });

  describe("updateTicket", () => {
    it("updates ticket status", async () => {
      const tickets = await listTickets({ status: "open" });
      const target = tickets[0];
      const updated = await updateTicket(target.id, { status: "in_progress" });
      expect(updated).toBeDefined();
      expect(updated!.status).toBe("in_progress");
    });

    it("sets closedAt when closing a ticket", async () => {
      const ticket = await createTicket({
        title: "Close test",
        description: "Will be closed",
        category: "other",
        priority: "low",
      });
      const closed = await closeTicket(ticket.id);
      expect(closed).toBeDefined();
      expect(closed!.status).toBe("closed");
      expect(closed!.closedAt).toBeTruthy();
    });
  });

  describe("addTicketMessage", () => {
    it("adds a reply message", async () => {
      const tickets = await listTickets();
      const target = tickets[0];
      const msg = await addTicketMessage(target.id, { message: "Test reply", type: "reply" });
      expect(msg).toBeDefined();
      expect(msg!.type).toBe("reply");
      expect(msg!.message).toBe("Test reply");
      expect(msg!.authorUserId).toBe(getCurrentUser().id);
    });

    it("adds an internal note", async () => {
      const tickets = await listTickets();
      const target = tickets[0];
      const msg = await addTicketMessage(target.id, { message: "Internal", type: "internal_note" });
      expect(msg).toBeDefined();
      expect(msg!.type).toBe("internal_note");
    });

    it("updates lastReplyAt and lastReplyBy for reply messages", async () => {
      const tickets = await listTickets();
      const target = tickets[0];
      const before = target.lastReplyAt;
      await addTicketMessage(target.id, { message: "New reply", type: "reply" });
      const updated = await getTicket(target.id);
      expect(updated!.lastReplyAt).not.toBe(before);
      expect(updated!.lastReplyBy).toBe(getCurrentUser().name);
    });
  });

  describe("listDashboardMetrics", () => {
    it("returns dashboard metrics", async () => {
      const metrics = await listDashboardMetrics();
      expect(metrics.openTickets).toBeGreaterThanOrEqual(0);
      expect(metrics.urgentTickets).toBeGreaterThanOrEqual(0);
      expect(metrics.waitingOnUser).toBeGreaterThanOrEqual(0);
      expect(metrics.resolvedToday).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.ticketsByProduct).toBe("object");
      expect(Array.isArray(metrics.recentActivity)).toBe(true);
      expect(metrics.recentActivity.length).toBeLessThanOrEqual(5);
    });

    it("has tickets grouped by product", async () => {
      const metrics = await listDashboardMetrics();
      expect(metrics.ticketsByProduct["streamline-edu"]).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ticket model normalized fields", () => {
    it("every ticket has required normalized fields", async () => {
      const tickets = await listTickets();
      for (const t of tickets) {
        expect(t.id).toBeTruthy();
        expect(t.ticketNumber).toBeTruthy();
        expect(t.product).toBeTruthy();
        expect(t.userId).toBeTruthy();
        expect(t.userName).toBeTruthy();
        expect(t.title).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(t.priority).toBeTruthy();
        expect(t.status).toBeTruthy();
        expect(t.source).toBeTruthy();
        expect(Array.isArray(t.tags)).toBe(true);
        expect(t.createdAt).toBeTruthy();
        expect(t.updatedAt).toBeTruthy();
        expect(Array.isArray(t.messages)).toBe(true);
      }
    });

    it("every message has required normalized fields", async () => {
      const tickets = await listTickets();
      const allMessages = tickets.flatMap(t => t.messages);
      for (const m of allMessages) {
        expect(m.id).toBeTruthy();
        expect(m.ticketId).toBeTruthy();
        expect(m.authorUserId).toBeTruthy();
        expect(m.authorName).toBeTruthy();
        expect(m.authorRole).toBeTruthy();
        expect(["reply", "internal_note", "status_change"]).toContain(m.type);
        expect(m.message).toBeTruthy();
        expect(m.createdAt).toBeTruthy();
      }
    });
  });
});
