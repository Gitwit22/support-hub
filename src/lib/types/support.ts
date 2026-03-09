export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "help_request" | "troubleshooting" | "account_access" | "incident" | "room_issue" | "behavior" | "technical" | "other";
export type UserRole = "teacher" | "school_admin" | "principal" | "district_staff" | "platform_admin" | "student";
export type MessageType = "reply" | "internal_note" | "status_change";

export type SupportProduct =
  | "streamline-edu"
  | "streamline-corporate"
  | "streamline-creator"
  | "horizon"
  | "mejay"
  | (string & {});

export const SUPPORTED_PRODUCTS: { value: SupportProduct; label: string }[] = [
  { value: "streamline-edu", label: "StreamLine EDU" },
  { value: "streamline-corporate", label: "StreamLine Corporate" },
  { value: "streamline-creator", label: "StreamLine Creator" },
  { value: "horizon", label: "Horizon" },
  { value: "mejay", label: "MEJay" },
];

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  authorRole: UserRole;
  type: MessageType;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  product: SupportProduct;
  tenantId?: string;
  orgId?: string;
  schoolId?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: string;
  tags: string[];
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  lastReplyAt?: string | null;
  lastReplyBy?: string | null;
  messages: TicketMessage[];
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  product?: SupportProduct;
  tenantId?: string;
  schoolId?: string;
  orgId?: string;
  assignedToUserId?: string;
  search?: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  product?: SupportProduct;
  tags?: string[];
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
}

export interface AddMessagePayload {
  message: string;
  type?: MessageType;
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
  email?: string;
  role: UserRole;
  school: string;
  schoolId?: string;
  tenantId?: string;
  orgId?: string;
}

export interface DashboardMetrics {
  openTickets: number;
  urgentTickets: number;
  waitingOnUser: number;
  resolvedToday: number;
  ticketsByProduct: Record<string, number>;
  recentActivity: Ticket[];
}
