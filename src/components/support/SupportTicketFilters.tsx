import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { TicketFilters, TicketStatus, TicketPriority, TicketCategory, SupportProduct } from "@/lib/types/support";
import { SUPPORTED_PRODUCTS } from "@/lib/types/support";
import { Search } from "lucide-react";

interface SupportTicketFiltersProps {
  filters: TicketFilters;
  onChange: (filters: TicketFilters) => void;
}

export function SupportTicketFilters({ filters, onChange }: SupportTicketFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by ticket #, title, user..."
          value={filters.search || ""}
          onChange={e => onChange({ ...filters, search: e.target.value || undefined })}
          className="pl-9"
        />
      </div>
      <Select value={filters.product || "all"} onValueChange={v => onChange({ ...filters, product: v === "all" ? undefined : v as SupportProduct })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Product" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Products</SelectItem>
          {SUPPORTED_PRODUCTS.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.status || "all"} onValueChange={v => onChange({ ...filters, status: v === "all" ? undefined : v as TicketStatus })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="waiting">Waiting</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.priority || "all"} onValueChange={v => onChange({ ...filters, priority: v === "all" ? undefined : v as TicketPriority })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.category || "all"} onValueChange={v => onChange({ ...filters, category: v === "all" ? undefined : v as TicketCategory })}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="help_request">Help Request</SelectItem>
          <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
          <SelectItem value="account_access">Account/Access</SelectItem>
          <SelectItem value="incident">Incident</SelectItem>
          <SelectItem value="behavior">Behavior</SelectItem>
          <SelectItem value="technical">Technical</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
