import type { Ticket } from "@/lib/types/support";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";

interface TicketCardProps {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
  showSchool?: boolean;
}

export function TicketCard({ ticket, onClick, showSchool }: TicketCardProps) {
  return (
    <button
      onClick={() => onClick(ticket)}
      className="w-full text-left rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-card-foreground truncate">{ticket.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <PriorityBadge priority={ticket.priority} />
        {showSchool && <span>{ticket.schoolId || ticket.orgId}</span>}
        <span className="capitalize">{ticket.category.replace("_", " ")}</span>
        {ticket.assignedToName && <span>→ {ticket.assignedToName}</span>}
        <span className="ml-auto flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {ticket.messages.length}
        </span>
        <span>{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
      </div>
    </button>
  );
}
