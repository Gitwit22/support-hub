import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listTickets,
  listMyTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketMessage,
  closeTicket,
  listDashboardMetrics,
  getCurrentUser,
  submitReportAsTicket,
} from "@/lib/api/support";
import type { Ticket, TicketMessage, CurrentUser, DashboardMetrics } from "@/lib/types/support";

// ---------------------------------------------------------------------------
// Helpers – stub fetch globally for each test
// ---------------------------------------------------------------------------

function mockFetchOnce(body: unknown, status = 200) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

function lastFetchCall() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [url, opts] = calls[calls.length - 1] as [string, RequestInit | undefined];
  return { url, opts };
}

// ---------------------------------------------------------------------------
// Sample payloads returned by the "server"
// ---------------------------------------------------------------------------

const sampleTicket: Ticket = {
  id: "t-001", ticketNumber: "TKT-001", product: "streamline-edu",
  tenantId: "tenant-district1", schoolId: "school-lincoln",
  userId: "u1", userName: "Sarah Chen", userEmail: "sarah.chen@lincoln.edu",
  title: "Projector not working", description: "Flickering image",
  category: "troubleshooting", priority: "high", status: "open",
  source: "web", tags: ["hardware"],
  assignedToUserId: null, assignedToName: null,
  messages: [], createdAt: "2026-03-08T09:30:00Z", updatedAt: "2026-03-08T10:00:00Z",
};

const sampleMessage: TicketMessage = {
  id: "m-1", ticketId: "t-001", authorUserId: "u-admin",
  authorName: "Admin User", authorRole: "platform_admin",
  type: "reply", message: "Looking into it", createdAt: "2026-03-08T11:00:00Z",
};

const sampleUser: CurrentUser = {
  id: "u-admin", name: "Admin User", email: "admin@nxtlvl.tech",
  role: "platform_admin", school: "District Office",
  schoolId: "school-district", tenantId: "tenant-nxtlvl",
};

const sampleMetrics: DashboardMetrics = {
  openTickets: 3, urgentTickets: 1, waitingOnUser: 1, resolvedToday: 0,
  ticketsByProduct: { "streamline-edu": 4, horizon: 1 },
  recentActivity: [sampleTicket],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("support API (real fetch)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  // --- listTickets ---------------------------------------------------------

  describe("listTickets", () => {
    it("calls GET /support/tickets with no filters", async () => {
      mockFetchOnce([sampleTicket]);
      const result = await listTickets();
      expect(result).toEqual([sampleTicket]);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/support/tickets");
      expect(opts?.method).toBeUndefined(); // GET by default
    });

    it("appends query params when filters are provided", async () => {
      mockFetchOnce([]);
      await listTickets({ status: "open", priority: "high", product: "streamline-edu", search: "projector" });
      const { url } = lastFetchCall();
      expect(url).toContain("status=open");
      expect(url).toContain("priority=high");
      expect(url).toContain("product=streamline-edu");
      expect(url).toContain("search=projector");
    });
  });

  // --- listMyTickets -------------------------------------------------------

  describe("listMyTickets", () => {
    it("calls GET /support/tickets/mine", async () => {
      mockFetchOnce([sampleTicket]);
      const result = await listMyTickets();
      expect(result).toEqual([sampleTicket]);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/support/tickets/mine");
    });
  });

  // --- getTicket -----------------------------------------------------------

  describe("getTicket", () => {
    it("calls GET /support/tickets/:id", async () => {
      mockFetchOnce(sampleTicket);
      const result = await getTicket("t-001");
      expect(result).toEqual(sampleTicket);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/support/tickets/t-001");
    });

    it("returns undefined on 404", async () => {
      mockFetchOnce(null, 404);
      const result = await getTicket("non-existent");
      expect(result).toBeUndefined();
    });
  });

  // --- createTicket --------------------------------------------------------

  describe("createTicket", () => {
    it("calls POST /support/tickets with payload", async () => {
      mockFetchOnce(sampleTicket);
      const payload = { title: "New", description: "Desc", category: "technical" as const, priority: "medium" as const };
      const result = await createTicket(payload);
      expect(result).toEqual(sampleTicket);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/support/tickets");
      expect(opts?.method).toBe("POST");
      expect(JSON.parse(opts?.body as string)).toEqual(payload);
    });
  });

  // --- updateTicket --------------------------------------------------------

  describe("updateTicket", () => {
    it("calls PATCH /support/tickets/:id", async () => {
      const updated = { ...sampleTicket, status: "in_progress" as const };
      mockFetchOnce(updated);
      const result = await updateTicket("t-001", { status: "in_progress" });
      expect(result).toEqual(updated);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/support/tickets/t-001");
      expect(opts?.method).toBe("PATCH");
    });

    it("returns undefined on 404", async () => {
      mockFetchOnce(null, 404);
      const result = await updateTicket("bad-id", { status: "closed" });
      expect(result).toBeUndefined();
    });
  });

  // --- addTicketMessage ----------------------------------------------------

  describe("addTicketMessage", () => {
    it("calls POST /support/tickets/:id/messages", async () => {
      mockFetchOnce(sampleMessage);
      const result = await addTicketMessage("t-001", { message: "Looking into it", type: "reply" });
      expect(result).toEqual(sampleMessage);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/support/tickets/t-001/messages");
      expect(opts?.method).toBe("POST");
    });

    it("returns undefined on 404", async () => {
      mockFetchOnce(null, 404);
      const result = await addTicketMessage("bad-id", { message: "Test" });
      expect(result).toBeUndefined();
    });
  });

  // --- closeTicket ---------------------------------------------------------

  describe("closeTicket", () => {
    it("calls POST /support/tickets/:id/close", async () => {
      const closed = { ...sampleTicket, status: "closed" as const, closedAt: "2026-03-09T12:00:00Z" };
      mockFetchOnce(closed);
      const result = await closeTicket("t-001");
      expect(result).toEqual(closed);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/support/tickets/t-001/close");
      expect(opts?.method).toBe("POST");
    });
  });

  // --- submitReportAsTicket ------------------------------------------------

  describe("submitReportAsTicket", () => {
    it("calls POST /support/reports", async () => {
      mockFetchOnce(sampleTicket);
      const result = await submitReportAsTicket({
        reportType: "incident", title: "Leak", description: "Water leak",
        severity: "high",
      });
      expect(result).toEqual(sampleTicket);
      const { url, opts } = lastFetchCall();
      expect(url).toBe("/api/support/reports");
      expect(opts?.method).toBe("POST");
    });
  });

  // --- getCurrentUser ------------------------------------------------------

  describe("getCurrentUser", () => {
    it("calls GET /support/me", async () => {
      mockFetchOnce(sampleUser);
      const result = await getCurrentUser();
      expect(result).toEqual(sampleUser);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/support/me");
    });
  });

  // --- listDashboardMetrics ------------------------------------------------

  describe("listDashboardMetrics", () => {
    it("calls GET /support/dashboard", async () => {
      mockFetchOnce(sampleMetrics);
      const result = await listDashboardMetrics();
      expect(result).toEqual(sampleMetrics);
      const { url } = lastFetchCall();
      expect(url).toBe("/api/support/dashboard");
    });
  });
});
