export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "help_request" | "troubleshooting" | "account_access" | "incident" | "room_issue" | "behavior" | "technical" | "other";
export type UserRole = "teacher" | "school_admin" | "principal" | "district_staff" | "platform_admin" | "student";

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  school: string;
  submittedBy: string;
  submittedById: string;
  submittedByRole: UserRole;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  tags: string[];
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  search?: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  tags?: string[];
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string | null;
}

export interface AddMessagePayload {
  content: string;
  isInternalNote?: boolean;
}

export interface ReportPayload {
  reportType: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  relatedEntity?: string;
  tags?: string[];
}

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  school: string;
}
