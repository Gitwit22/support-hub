import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/lib/types/support";

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-info/15 text-info border-info/30" },
  in_progress: { label: "In Progress", className: "bg-warning/15 text-warning border-warning/30" },
  waiting: { label: "Waiting", className: "bg-muted text-muted-foreground border-border" },
  resolved: { label: "Resolved", className: "bg-success/15 text-success border-success/30" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
