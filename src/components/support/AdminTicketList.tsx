import type { Ticket } from "@/lib/types/support";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { formatDistanceToNow } from "date-fns";
import { Inbox, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminTicketListProps {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  selectedTicketId?: string | null;
  loading?: boolean;
  emptyMessage?: string;
}

export function AdminTicketList({ tickets, onSelect, selectedTicketId, loading, emptyMessage = "No tickets found" }: AdminTicketListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Table header — desktop only */}
      <div className="hidden lg:grid lg:grid-cols-[90px_1fr_120px_130px_90px_100px_90px_100px] gap-2 px-4 py-2.5 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
        <span>Ticket #</span>
        <span>Title</span>
        <span>Submitted by</span>
        <span>School</span>
        <span>Priority</span>
        <span>Status</span>
        <span className="text-center">Msgs</span>
        <span>Updated</span>
      </div>

      {/* Rows */}
      {tickets.map(ticket => (
        <button
          key={ticket.id}
          onClick={() => onSelect(ticket)}
          className={cn(
            "w-full text-left border-b border-border last:border-b-0 px-4 py-3 transition-colors focus:outline-none",
            selectedTicketId === ticket.id
              ? "bg-primary/10 border-l-2 border-l-primary"
              : "hover:bg-muted/40 focus:bg-muted/40"
          )}
        >
          {/* Desktop row */}
          <div className="hidden lg:grid lg:grid-cols-[90px_1fr_120px_130px_90px_100px_90px_100px] gap-2 items-center">
            <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
            <span className="text-sm font-medium text-card-foreground truncate">{ticket.title}</span>
            <span className="text-xs text-muted-foreground truncate">{ticket.userName}</span>
            <span className="text-xs text-muted-foreground truncate">{ticket.schoolId || "—"}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            <span className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <MessageSquare className="h-3 w-3" />{ticket.messages.length}
            </span>
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
          </div>

          {/* Mobile card */}
          <div className="lg:hidden space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                </div>
                <p className="text-sm font-medium text-card-foreground truncate">{ticket.title}</p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <PriorityBadge priority={ticket.priority} />
              <span>{ticket.userName}</span>
              {ticket.schoolId && <span>{ticket.schoolId}</span>}
              {ticket.assignedToName && <span>→ {ticket.assignedToName}</span>}
              <span className="ml-auto">{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
