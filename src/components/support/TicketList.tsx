import type { Ticket } from "@/lib/types/support";
import { TicketCard } from "./TicketCard";
import { Inbox } from "lucide-react";

interface TicketListProps {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  loading?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  showSchool?: boolean;
}

export function TicketList({ tickets, onSelect, loading, emptyMessage = "No tickets yet", emptyAction, showSchool }: TicketListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">{emptyMessage}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map(ticket => (
        <TicketCard key={ticket.id} ticket={ticket} onClick={onSelect} showSchool={showSchool} />
      ))}
    </div>
  );
}
