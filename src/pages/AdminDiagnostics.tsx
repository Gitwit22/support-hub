import { useState, useEffect } from "react";
import { listDiagnostics } from "@/lib/api/admin";
import type { DiagnosticEntry, DiagnosticSeverity } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

const severityConfig: Record<DiagnosticSeverity, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  error:   { label: "Error",   color: "text-destructive",       bg: "bg-red-50 dark:bg-red-950",    icon: AlertCircle },
  warning: { label: "Warning", color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950", icon: AlertTriangle },
  info:    { label: "Info",    color: "text-muted-foreground",   bg: "bg-muted",                      icon: Info },
};

type FilterSeverity = DiagnosticSeverity | "all";

export default function DiagnosticsPage() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterSeverity>("all");

  useEffect(() => {
    listDiagnostics().then((d) => { setEntries(d); setLoading(false); });
  }, []);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.severity === filter);

  const counts = {
    all: entries.length,
    error: entries.filter((e) => e.severity === "error").length,
    warning: entries.filter((e) => e.severity === "warning").length,
    info: entries.filter((e) => e.severity === "info").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Diagnostics</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const filterButtons: { key: FilterSeverity; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "error", label: `Errors (${counts.error})` },
    { key: "warning", label: `Warnings (${counts.warning})` },
    { key: "info", label: `Info (${counts.info})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">Recent errors, warnings, and system events.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((fb) => (
          <button
            key={fb.key}
            onClick={() => setFilter(fb.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === fb.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No diagnostic entries match the current filter.</p>
        ) : (
          filtered.map((entry) => {
            const cfg = severityConfig[entry.severity];
            const SeverityIcon = cfg.icon;
            return (
              <div key={entry.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1 ${cfg.bg}`}>
                      <SeverityIcon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-card-foreground">{entry.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Source: {entry.source}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                  </span>
                </div>
                {entry.details && (
                  <p className="ml-10 text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono">{entry.details}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
