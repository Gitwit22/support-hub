import type { Ticket } from "@/lib/types/support";
import { StatusBadge } from "./StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Inbox } from "lucide-react";

interface ResponseInboxProps {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  loading?: boolean;
}

export function ResponseInbox({ tickets, onSelect, loading }: ResponseInboxProps) {
  const withResponses = tickets.filter(t => t.messages.length > 0).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  if (withResponses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">No responses yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Replies will appear here when support responds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {withResponses.map(ticket => {
        const lastMsg = ticket.messages[ticket.messages.length - 1];
        return (
          <button
            key={ticket.id}
            onClick={() => onSelect(ticket)}
            className="w-full text-left rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-medium text-card-foreground truncate">{ticket.title}</h4>
              <StatusBadge status={ticket.status} />
            </div>
            {lastMsg && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                <span className="font-medium">{lastMsg.authorName}:</span> {lastMsg.content}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket.messages.length} messages</span>
              <span>{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
