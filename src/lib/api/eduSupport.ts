// Re-export everything from the shared support API.
// Product-facing apps import from here — the shared layer handles all logic.
export {
  setCurrentUserKey,
  getCurrentUser,
  listTickets,
  listMyTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketMessage,
  closeTicket,
  submitReportAsTicket,
  listDashboardMetrics,
} from "@/lib/api/support";

