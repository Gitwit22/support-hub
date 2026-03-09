import { useState, useEffect } from "react";
import { listDashboardMetrics } from "@/lib/api/support";
import { SupportProductBadge } from "./SupportProductBadge";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import type { DashboardMetrics, SupportProduct } from "@/lib/types/support";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Clock, CheckCircle2, AlertTriangle, BarChart3, Activity } from "lucide-react";

export function SupportDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDashboardMetrics().then(m => { setMetrics(m); setLoading(false); });
  }, []);

  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />)}
        </div>
      </div>
    );
  }

  const summaryCards = [
    { label: "Open Tickets", value: metrics.openTickets, icon: AlertCircle, color: "text-info" },
    { label: "Urgent", value: metrics.urgentTickets, icon: AlertTriangle, color: "text-destructive" },
    { label: "Waiting on User", value: metrics.waitingOnUser, icon: Clock, color: "text-warning" },
    { label: "Resolved Today", value: metrics.resolvedToday, icon: CheckCircle2, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(card => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tickets by product */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-card-foreground">Tickets by Product</h3>
          </div>
          {Object.keys(metrics.ticketsByProduct).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tickets yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(metrics.ticketsByProduct)
                .sort(([, a], [, b]) => b - a)
                .map(([product, count]) => (
                  <div key={product} className="flex items-center justify-between">
                    <SupportProductBadge product={product as SupportProduct} />
                    <div className="flex items-center gap-3">
                      <div className="h-2 rounded-full bg-primary/20 w-24">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (count / Math.max(...Object.values(metrics.ticketsByProduct))) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-card-foreground w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-card-foreground">Recent Activity</h3>
          </div>
          {metrics.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {metrics.recentActivity.map(ticket => (
                <div key={ticket.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">{ticket.ticketNumber}</span>
                      <SupportProductBadge product={ticket.product} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-card-foreground truncate">{ticket.title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
