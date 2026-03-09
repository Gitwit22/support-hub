import type { TicketMessage } from "@/lib/types/support";
import { format } from "date-fns";
import { Lock, RefreshCw } from "lucide-react";

interface SupportMessageThreadProps {
  messages: TicketMessage[];
}

export function SupportMessageThread({ messages }: SupportMessageThreadProps) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No messages yet.</p>;
  }

  return (
    <div className="space-y-3">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`rounded-lg border p-4 ${
            msg.type === "internal_note"
              ? "border-warning/30 bg-warning/5"
              : msg.type === "status_change"
              ? "border-info/30 bg-info/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-card-foreground">{msg.authorName}</span>
            <span className="text-xs text-muted-foreground capitalize">{msg.authorRole.replace("_", " ")}</span>
            {msg.type === "internal_note" && (
              <span className="flex items-center gap-1 text-xs text-warning font-medium">
                <Lock className="h-3 w-3" /> Internal Note
              </span>
            )}
            {msg.type === "status_change" && (
              <span className="flex items-center gap-1 text-xs text-info font-medium">
                <RefreshCw className="h-3 w-3" /> Status Change
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {format(new Date(msg.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
          <p className="text-sm text-card-foreground whitespace-pre-wrap">{msg.message}</p>
        </div>
      ))}
    </div>
  );
}
