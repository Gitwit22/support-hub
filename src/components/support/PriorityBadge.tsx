import { cn } from "@/lib/utils";
import type { TicketPriority } from "@/lib/types/support";

const priorityConfig: Record<TicketPriority, { label: string; className: string; dot: string }> = {
  low: { label: "Low", className: "text-muted-foreground", dot: "bg-muted-foreground" },
  medium: { label: "Medium", className: "text-info", dot: "bg-info" },
  high: { label: "High", className: "text-warning", dot: "bg-warning" },
  urgent: { label: "Urgent", className: "text-destructive", dot: "bg-destructive" },
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config = priorityConfig[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", config.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
