import { useState, useEffect, useMemo } from "react";
import { listDiagnostics } from "@/lib/api/admin";
import type { DiagnosticEntry, DiagnosticSeverity } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, Info, Activity, Copy, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearStreamlineDiagnostics,
  formatStreamlineDiagnosticsReport,
  getStreamlineDiagnostics,
  runStreamlineDiagnosticsChecks,
  type StreamlineDiagnostics,
} from "@/services/streamlineApi";
import { useProgram } from "@/lib/programs/ProgramContext";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatusPill({ tone, label }: { tone: "green" | "yellow" | "red" | "gray"; label: string }) {
  const styles = {
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    gray:   "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm text-card-foreground">{value || "-"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StreamLine diagnostics view — connection tests, endpoint health, errors
// ---------------------------------------------------------------------------

function StreamLineDiagnosticsView() {
  const [diagnostics, setDiagnostics] = useState<StreamlineDiagnostics>(() => getStreamlineDiagnostics());
  const [running, setRunning] = useState(false);
  const [actionState, setActionState] = useState<string | null>(null);

  const refreshDiagnostics = async (successMessage = "Connection test completed") => {
    setRunning(true);
    try {
      const next = await runStreamlineDiagnosticsChecks();
      setDiagnostics(next);
      setActionState(successMessage);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    refreshDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overallState = useMemo(() => {
    if (!diagnostics.configured) return { label: "Disconnected", tone: "red" as const };
    const hasFailure = diagnostics.endpointChecks.some(
      (item) => item.reachable === false || item.validationPassed === false
    );
    const anySuccess = diagnostics.endpointChecks.some((item) => item.reachable === true);
    if (hasFailure && anySuccess) return { label: "Warning", tone: "yellow" as const };
    if (hasFailure) return { label: "Disconnected", tone: "red" as const };
    if (anySuccess) return { label: "Connected", tone: "green" as const };
    return { label: "Disconnected", tone: "red" as const };
  }, [diagnostics]);

  const handleClear = () => {
    clearStreamlineDiagnostics();
    setDiagnostics(getStreamlineDiagnostics());
    setActionState("Diagnostics cleared");
  };

  const handleCopy = async () => {
    const report = formatStreamlineDiagnosticsReport(diagnostics);
    try {
      await navigator.clipboard.writeText(report);
      setActionState("Diagnostics copied");
    } catch {
      setActionState("Clipboard unavailable");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnostics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            StreamLine integration — connection tests and endpoint health.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => refreshDiagnostics("Connection test completed")} disabled={running} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            Run Connection Test
          </Button>
          <Button onClick={() => refreshDiagnostics("All endpoint checks completed")} disabled={running} variant="outline" className="gap-2">
            <Activity className="h-4 w-4" />
            Recheck All Endpoints
          </Button>
          <Button onClick={handleClear} variant="outline" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Clear Errors
          </Button>
          <Button onClick={handleCopy} variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Summary
          </Button>
        </div>
      </div>

      {actionState && <p className="text-sm text-muted-foreground">{actionState}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Overall Connection</h2>
              <p className="text-sm text-muted-foreground">Current StreamLine integration summary.</p>
            </div>
            <StatusPill tone={overallState.tone} label={overallState.label} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Current Mode" value={diagnostics.supportDataSource || "default"} />
            <InfoRow label="Base URL" value={diagnostics.baseUrl || "-"} />
            <InfoRow label="Auth Configured" value={diagnostics.authConfigured ? "yes" : "no"} />
            <InfoRow label="Strict Validation" value={diagnostics.strictValidation ? "yes" : "no"} />
            <InfoRow label="Last Successful Sync" value={diagnostics.lastSuccessfulConnectionAt || "-"} />
            <InfoRow label="Last Failed Sync" value={diagnostics.lastFailedConnectionAt || "-"} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Polling Health</h2>
              <p className="text-sm text-muted-foreground">Visibility into room polling activity.</p>
            </div>
            <PlugZap className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Polling Enabled" value={diagnostics.polling.enabled ? "yes" : "no"} />
            <InfoRow label="Polling Interval" value={diagnostics.polling.intervalMs ? `${diagnostics.polling.intervalMs}ms` : "-"} />
            <InfoRow label="Last Poll Attempt" value={diagnostics.polling.lastPollAttemptAt || "-"} />
            <InfoRow label="Consecutive Failures" value={String(diagnostics.polling.consecutiveFailures)} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Endpoint Health</h2>
          <p className="text-sm text-muted-foreground">
            Latest probe result for each StreamLine support endpoint.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {diagnostics.endpointChecks.map((item) => {
            const tone =
              item.reachable === true && item.validationPassed !== false
                ? "green"
                : item.reachable === false || item.validationPassed === false
                  ? "red"
                  : "gray";
            return (
              <div key={item.endpoint} className="rounded-lg border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{item.endpoint}</h3>
                    <p className="text-xs text-muted-foreground">Last success: {item.lastSuccessAt || "-"}</p>
                  </div>
                  <StatusPill
                    tone={tone}
                    label={item.reachable === true ? "Reachable" : item.reachable === false ? "Failed" : "Pending"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="HTTP Status" value={String(item.httpStatusCode ?? "-")} />
                  <InfoRow label="Response Time" value={item.responseTimeMs !== undefined ? `${item.responseTimeMs}ms` : "-"} />
                  <InfoRow label="Validation Passed" value={item.validationPassed === null ? "unknown" : item.validationPassed ? "yes" : "no"} />
                  <InfoRow label="Last Failure" value={item.lastFailureAt || "-"} />
                </div>
                <p className="text-sm text-muted-foreground">{item.errorMessage || "No errors recorded."}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Validation Status</h2>
            <p className="text-sm text-muted-foreground">Latest contract validation result for each payload type.</p>
          </div>
          <div className="space-y-3">
            {diagnostics.validationChecks.map((item) => (
              <div key={item.key} className="rounded-md border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{item.key}</p>
                    <p className="text-xs text-muted-foreground">{item.endpoint}</p>
                  </div>
                  <StatusPill
                    tone={item.valid === true ? "green" : item.valid === false ? "red" : "gray"}
                    label={item.valid === true ? "Valid" : item.valid === false ? "Invalid" : "Pending"}
                  />
                </div>
                {item.details.length > 0 ? (
                  <div className="space-y-1">
                    {item.details.map((detail) => (
                      <p key={detail} className="text-xs text-destructive">{detail}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No validation mismatches recorded.</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Recent Errors</h2>
            <p className="text-sm text-muted-foreground">Most recent StreamLine integration failures.</p>
          </div>
          <div className="space-y-3">
            {diagnostics.recentErrors.length === 0 ? (
              <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                No recent errors recorded.
              </div>
            ) : (
              diagnostics.recentErrors.map((item) => (
                <div
                  key={`${item.timestamp}-${item.endpoint}-${item.category}`}
                  className="rounded-md border border-border bg-background p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-card-foreground">{item.endpoint}</p>
                    <StatusPill
                      tone={
                        item.category === "validation"
                          ? "yellow"
                          : ["auth", "http", "network", "timeout", "config"].includes(item.category)
                            ? "red"
                            : "gray"
                      }
                      label={item.category}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic diagnostics view — API event log for non-StreamLine programs
// ---------------------------------------------------------------------------

const severityConfig: Record<DiagnosticSeverity, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  error:   { label: "Error",   color: "text-destructive",       bg: "bg-red-50 dark:bg-red-950",    icon: AlertCircle },
  warning: { label: "Warning", color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950", icon: AlertTriangle },
  info:    { label: "Info",    color: "text-muted-foreground",   bg: "bg-muted",                      icon: Info },
};

type FilterSeverity = DiagnosticSeverity | "all";

function GenericDiagnosticsView() {
  const { activeProgramId, activeProgram } = useProgram();
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterSeverity>("all");

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    listDiagnostics(activeProgramId).then((d) => {
      setEntries(d);
      setLoading(false);
    });
  }, [activeProgramId]);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.severity === filter);
  const counts = {
    all: entries.length,
    error: entries.filter((e) => e.severity === "error").length,
    warning: entries.filter((e) => e.severity === "warning").length,
    info: entries.filter((e) => e.severity === "info").length,
  };

  const filterButtons: { key: FilterSeverity; label: string }[] = [
    { key: "all",     label: `All (${counts.all})` },
    { key: "error",   label: `Errors (${counts.error})` },
    { key: "warning", label: `Warnings (${counts.warning})` },
    { key: "info",    label: `Info (${counts.info})` },
  ];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent errors, warnings, and system events for{" "}
          <span className="font-medium">{activeProgram.name}</span>.
        </p>
      </div>

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

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No diagnostic entries match the current filter.
          </p>
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
                  <p className="ml-10 text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono">
                    {entry.details}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — gates by active program
// ---------------------------------------------------------------------------

export default function DiagnosticsPage() {
  const { activeProgram } = useProgram();

  if (activeProgram.slug === "streamline") {
    return <StreamLineDiagnosticsView />;
  }

  return <GenericDiagnosticsView />;
}
