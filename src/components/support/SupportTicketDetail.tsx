import { useState } from "react";
import type { Ticket, AddMessagePayload, UpdateTicketPayload, TicketStatus } from "@/lib/types/support";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { SupportProductBadge } from "./SupportProductBadge";
import { SupportMessageThread } from "./SupportMessageThread";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ArrowLeft, Send, User, Clock, Tag, Mail, Building, Hash } from "lucide-react";

interface SupportTicketDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onReply: (ticketId: string, payload: AddMessagePayload) => Promise<void>;
  onUpdate: (ticketId: string, payload: UpdateTicketPayload) => Promise<void>;
  onClose: (ticketId: string) => Promise<void>;
}

export function SupportTicketDetail({ ticket, onBack, onReply, onUpdate, onClose }: SupportTicketDetailProps) {
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
    await onUpdate(ticket.id, { status });
  };

  const handleAssign = async () => {
    if (assignTo.trim()) await onUpdate(ticket.id, { assignedToName: assignTo.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to tickets
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
              <SupportProductBadge product={ticket.product} />
            </div>
            <h2 className="text-xl font-bold text-foreground">{ticket.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.status !== "closed" && (
              <Button variant="outline" size="sm" onClick={() => onClose(ticket.id)}>Close</Button>
            )}
          </div>
        </div>
      </div>

      {/* Full metadata */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Submitted by</p>
          <p className="text-sm font-medium text-card-foreground">{ticket.userName}</p>
        </div>
        {ticket.userEmail && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
            <p className="text-sm text-card-foreground truncate">{ticket.userEmail}</p>
          </div>
        )}
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
        {(ticket.schoolId || ticket.orgId) && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" /> Org / School</p>
            <p className="text-sm text-card-foreground">{ticket.schoolId || ticket.orgId}</p>
          </div>
        )}
        {ticket.tenantId && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> Tenant</p>
            <p className="text-sm text-card-foreground">{ticket.tenantId}</p>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Source</p>
          <p className="text-sm capitalize text-card-foreground">{ticket.source}</p>
        </div>
      </div>

      {/* Admin actions */}
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

      {/* Message thread */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Thread ({ticket.messages.length})</h3>
        <SupportMessageThread messages={ticket.messages} />
      </div>

      {/* Reply box */}
      {ticket.status !== "closed" && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Textarea
            placeholder={isInternal ? "Write an internal note (hidden from product users)..." : "Write a reply..."}
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox checked={isInternal} onCheckedChange={c => setIsInternal(c === true)} />
              Internal note
            </label>
            <Button onClick={handleReply} disabled={sending || !replyContent.trim()} size="sm">
              <Send className="mr-1 h-3.5 w-3.5" /> {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
