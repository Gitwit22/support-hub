import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { CreateTicketPayload, TicketCategory, TicketPriority } from "@/lib/types/support";
import { X } from "lucide-react";

interface TicketComposerProps {
  onSubmit: (payload: CreateTicketPayload) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const categories: { value: TicketCategory; label: string }[] = [
  { value: "help_request", label: "Help Request" },
  { value: "troubleshooting", label: "Troubleshooting" },
  { value: "account_access", label: "Account / Access" },
  { value: "technical", label: "Technical Issue" },
  { value: "other", label: "Other" },
];

const priorities: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TicketComposer({ onSubmit, onCancel, loading }: TicketComposerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("help_request");
  const [priority, setPriority] = useState<TicketPriority>("medium");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    await onSubmit({ title: title.trim(), description: description.trim(), category, priority });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-card-foreground">Open a New Ticket</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-title">Title</Label>
        <Input id="ticket-title" placeholder="Brief summary of the issue..." value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-desc">Description</Label>
        <Textarea id="ticket-desc" placeholder="Describe the issue in detail..." value={description} onChange={e => setDescription(e.target.value)} required maxLength={2000} rows={4} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as TicketCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={v => setPriority(v as TicketPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading || !title.trim() || !description.trim()}>
          {loading ? "Submitting..." : "Submit Ticket"}
        </Button>
      </div>
    </form>
  );
}
