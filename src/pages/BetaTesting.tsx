import { useState, useEffect, useCallback } from "react";
import { listBetaEvents } from "@/lib/api/beta";
import type { BetaEvent, BetaSeverity } from "@/lib/types/beta";
import { formatDistanceToNow } from "date-fns";
import { FlaskConical, AlertCircle, AlertTriangle, Info, ShieldAlert, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// Severity display config
// ---------------------------------------------------------------------------

const severityConfig: Record<
  BetaSeverity,
  { label: string; color: string; bg: string; icon: typeof AlertCircle }
> = {
  critical: { label: "Critical", color: "text-destructive",      bg: "bg-red-50 dark:bg-red-950",      icon: ShieldAlert },
  error:    { label: "Error",    color: "text-orange-600",       bg: "bg-orange-50 dark:bg-orange-950", icon: AlertCircle },
  warning:  { label: "Warning",  color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-950",   icon: AlertTriangle },
  info:     { label: "Info",     color: "text-muted-foreground", bg: "bg-muted",                        icon: Info },
};

const SEVERITY_FILTERS: Array<{ value: BetaSeverity | "all"; label: string }> = [
  { value: "all",      label: "All" },
  { value: "critical", label: "Critical" },
  { value: "error",    label: "Error" },
  { value: "warning",  label: "Warning" },
  { value: "info",     label: "Info" },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BetaTestingPage() {
  const [events, setEvents] = useState<BetaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<BetaSeverity | "all">("all");
  const [systemSearch, setSystemSearch] = useState("");
  const [debouncedSystem, setDebouncedSystem] = useState("");

  // Debounce the system name search so we don't refetch on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSystem(systemSearch), 300);
    return () => clearTimeout(timer);
  }, [systemSearch]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const data = await listBetaEvents({
      severity: severityFilter,
      systemName: debouncedSystem || undefined,
    });
    setEvents(data);
    setLoading(false);
  }, [severityFilter, debouncedSystem]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Beta Testing</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Beta Testing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Events received from external programs — newest first.
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity pills */}
        <div className="flex flex-wrap gap-2">
          {SEVERITY_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSeverityFilter(value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                severityFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* System name search */}
        <input
          type="text"
          placeholder="Filter by system…"
          value={systemSearch}
          onChange={(e) => setSystemSearch(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Events table */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No beta events</p>
          <p className="text-xs text-muted-foreground mt-1">
            Events will appear here once external programs start reporting.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">System</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Severity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => {
                const cfg = severityConfig[event.severity];
                const SevIcon = cfg.icon;
                return (
                  <tr
                    key={event.id}
                    className={`border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-card-foreground whitespace-nowrap">
                      {event.systemName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {event.feature}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                      >
                        <SevIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-card-foreground max-w-sm truncate">
                      {event.message}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
