import { useState, useEffect } from "react";
import { listAlerts } from "@/lib/api/admin";
import type { Alert, AlertSeverity, AlertStatus } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, ShieldAlert } from "lucide-react";

const severityConfig: Record<AlertSeverity, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  critical: { label: "Critical", color: "text-destructive",       bg: "bg-red-50 dark:bg-red-950",      icon: ShieldAlert },
  high:     { label: "High",     color: "text-orange-600",        bg: "bg-orange-50 dark:bg-orange-950", icon: AlertCircle },
  medium:   { label: "Medium",   color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950",   icon: AlertTriangle },
  low:      { label: "Low",      color: "text-blue-600",          bg: "bg-blue-50 dark:bg-blue-950",     icon: Bell },
  info:     { label: "Info",     color: "text-muted-foreground",  bg: "bg-muted",                        icon: Info },
};

const statusBadge: Record<AlertStatus, { label: string; color: string; bg: string }> = {
  active:       { label: "Active",       color: "text-destructive",       bg: "bg-red-50 dark:bg-red-950" },
  acknowledged: { label: "Acknowledged", color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950" },
  resolved:     { label: "Resolved",     color: "text-emerald-600",       bg: "bg-emerald-50 dark:bg-emerald-950" },
};

type FilterStatus = AlertStatus | "all";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    listAlerts().then((a) => { setAlerts(a); setLoading(false); });
  }, []);

  const filtered = statusFilter === "all" ? alerts : alerts.filter((a) => a.status === statusFilter);

  const counts = {
    all: alerts.length,
    active: alerts.filter((a) => a.status === "active").length,
    acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const filterButtons: { key: FilterStatus; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "active", label: `Active (${counts.active})` },
    { key: "acknowledged", label: `Ack'd (${counts.acknowledged})` },
    { key: "resolved", label: `Resolved (${counts.resolved})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Current alerts, history, and severity levels.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((fb) => (
          <button
            key={fb.key}
            onClick={() => setStatusFilter(fb.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === fb.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm text-muted-foreground">No alerts match the current filter.</p>
          </div>
        ) : (
          filtered.map((alert) => {
            const sevCfg = severityConfig[alert.severity];
            const stCfg = statusBadge[alert.status];
            const SevIcon = sevCfg.icon;
            return (
              <div key={alert.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1 ${sevCfg.bg}`}>
                      <SevIcon className={`h-4 w-4 ${sevCfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-card-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stCfg.bg} ${stCfg.color}`}>
                      {stCfg.label}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sevCfg.bg} ${sevCfg.color}`}>
                      {sevCfg.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground ml-10">
                  <span>Service: {alert.service}</span>
                  <span>Created {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
