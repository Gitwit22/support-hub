import { useState } from "react";
import type { Ticket, AddMessagePayload, UpdateTicketPayload, TicketStatus } from "@/lib/types/support";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ArrowLeft, Send, Lock, User, Clock, Tag } from "lucide-react";

interface TicketDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onReply: (ticketId: string, payload: AddMessagePayload) => Promise<void>;
  onUpdate?: (ticketId: string, payload: UpdateTicketPayload) => Promise<void>;
  onClose?: (ticketId: string) => Promise<void>;
  isAdmin?: boolean;
}

export function TicketDetail({ ticket, onBack, onReply, onUpdate, onClose, isAdmin }: TicketDetailProps) {
  const [replyContent, setReplyContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [assignTo, setAssignTo] = useState(ticket.assignedToName || "");

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setSending(true);
    await onReply(ticket.id, { message: replyContent.trim(), type: isInternal ? "internal_note" : "reply" });
    setReplyContent("");
    setIsInternal(false);
    setSending(false);
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (onUpdate) await onUpdate(ticket.id, { status });
  };

  const handleAssign = async () => {
    if (onUpdate && assignTo.trim()) await onUpdate(ticket.id, { assignedToName: assignTo.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to list
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{ticket.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{ticket.ticketNumber} · {ticket.schoolId || ticket.orgId || ticket.product}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {isAdmin && ticket.status !== "closed" && onClose && (
              <Button variant="outline" size="sm" onClick={() => onClose(ticket.id)}>Close</Button>
            )}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Submitted by</p>
          <p className="text-sm font-medium text-card-foreground">{ticket.userName}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Priority</p>
          <PriorityBadge priority={ticket.priority} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Created</p>
          <p className="text-sm text-card-foreground">{format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Category</p>
          <p className="text-sm capitalize text-card-foreground">{ticket.category.replace("_", " ")}</p>
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && onUpdate && (
        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={ticket.status} onValueChange={v => handleStatusChange(v as TicketStatus)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["open", "in_progress", "waiting", "resolved", "closed"] as TicketStatus[]).map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Assign to</Label>
              <Input value={assignTo} onChange={e => setAssignTo(e.target.value)} placeholder="Name or team..." className="w-[180px]" />
            </div>
            <Button variant="outline" size="sm" onClick={handleAssign}>Assign</Button>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-card-foreground whitespace-pre-wrap">{ticket.description}</p>
        {ticket.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ticket.tags.map(tag => (
              <span key={tag} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Thread ({ticket.messages.length})</h3>
        {ticket.messages.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No messages yet.</p>
        )}
        {ticket.messages.map(msg => (
          <div key={msg.id} className={`rounded-lg border p-4 ${msg.type === "internal_note" ? "border-warning/30 bg-warning/5" : msg.type === "status_change" ? "border-info/30 bg-info/5" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-card-foreground">{msg.authorName}</span>
              <span className="text-xs text-muted-foreground capitalize">{msg.authorRole.replace("_", " ")}</span>
              {msg.type === "internal_note" && (
                <span className="flex items-center gap-1 text-xs text-warning font-medium">
                  <Lock className="h-3 w-3" /> Internal Note
                </span>
              )}
              {msg.type === "status_change" && (
                <span className="text-xs text-info font-medium">Status Change</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
            </div>
            <p className="text-sm text-card-foreground whitespace-pre-wrap">{msg.message}</p>
          </div>
        ))}
      </div>

      {/* Reply box */}
      {ticket.status !== "closed" && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Textarea
            placeholder={isInternal ? "Write an internal note (hidden from non-admins)..." : "Write a reply..."}
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox checked={isInternal} onCheckedChange={c => setIsInternal(c === true)} />
                  Internal note
                </label>
              )}
            </div>
            <Button onClick={handleReply} disabled={sending || !replyContent.trim()} size="sm">
              <Send className="mr-1 h-3.5 w-3.5" /> {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
