import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Copy,
  PlugZap,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import {
  clearStreamlineDiagnostics,
  formatStreamlineDiagnosticsReport,
  getStreamlineDiagnostics,
  runStreamlineDiagnosticsChecks,
  type StreamlineDiagnostics,
} from "@/services/streamlineApi";

function StatusPill({ tone, label }: { tone: "green" | "yellow" | "red" | "gray"; label: string }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-muted text-muted-foreground border-border",
  };

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{label}</span>;
}

export default function AdminSettingsPage() {
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
  }, []);

  const overallState = useMemo(() => {
    if (!diagnostics.configured) return { label: "Disconnected", tone: "red" as const };
    const hasFailure = diagnostics.endpointChecks.some((item) => item.reachable === false || item.validationPassed === false);
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

  const endpointCards = diagnostics.endpointChecks;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnostics</h1>
          <p className="mt-1 text-sm text-muted-foreground">StreamLine Connection & Health</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={refreshDiagnostics} disabled={running} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            Run Connection Test
          </Button>
          <Button onClick={() => refreshDiagnostics("All endpoint checks completed")} disabled={running} variant="outline" className="gap-2">
            <Activity className="h-4 w-4" />
            Recheck All Endpoints
          </Button>
          <Button onClick={handleClear} variant="outline" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Clear Diagnostics Errors
          </Button>
          <Button onClick={handleCopy} variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Diagnostics Summary
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
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Mode</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.supportDataSource || "default"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Base URL</p>
              <p className="mt-1 break-all text-sm text-card-foreground">{diagnostics.baseUrl || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Auth Configured</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.authConfigured ? "yes" : "no"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Strict Validation</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.strictValidation ? "yes" : "no"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Successful Sync</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.lastSuccessfulConnectionAt || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Failed Sync</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.lastFailedConnectionAt || "-"}</p>
            </div>
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
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Polling Enabled</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.polling.enabled ? "yes" : "no"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Polling Interval</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.polling.intervalMs ? `${diagnostics.polling.intervalMs}ms` : "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Poll Attempt</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.polling.lastPollAttemptAt || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Consecutive Failures</p>
              <p className="mt-1 text-sm text-card-foreground">{diagnostics.polling.consecutiveFailures}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Endpoint Health</h2>
          <p className="text-sm text-muted-foreground">Latest probe result for each StreamLine support endpoint.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {endpointCards.map((item) => {
            const tone = item.reachable === true && item.validationPassed !== false
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
                  <StatusPill tone={tone} label={item.reachable === true ? "Reachable" : item.reachable === false ? "Failed" : "Pending"} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">HTTP Status</p>
                    <p className="mt-1 text-card-foreground">{item.httpStatusCode ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Response Time</p>
                    <p className="mt-1 text-card-foreground">{item.responseTimeMs !== undefined ? `${item.responseTimeMs}ms` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Validation Passed</p>
                    <p className="mt-1 text-card-foreground">{item.validationPassed === null ? "unknown" : item.validationPassed ? "yes" : "no"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Failure</p>
                    <p className="mt-1 text-card-foreground">{item.lastFailureAt || "-"}</p>
                  </div>
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
            ) : diagnostics.recentErrors.map((item) => (
              <div key={`${item.timestamp}-${item.endpoint}-${item.category}`} className="rounded-md border border-border bg-background p-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-card-foreground">{item.endpoint}</p>
                  <StatusPill
                    tone={item.category === "validation" ? "yellow" : item.category === "auth" || item.category === "http" || item.category === "network" || item.category === "timeout" || item.category === "config" ? "red" : "gray"}
                    label={item.category}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                <p className="text-sm text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-card-foreground">Environment / Config</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">VITE_SUPPORT_DATA_SOURCE</p>
            <p className="mt-1 text-card-foreground">{diagnostics.supportDataSource || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">VITE_STREAMLINE_API_BASE_URL</p>
            <p className="mt-1 break-all text-card-foreground">{diagnostics.baseUrl || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Token/Auth Configured</p>
            <p className="mt-1 text-card-foreground">{diagnostics.authConfigured ? "yes" : "no"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Strict Validation</p>
            <p className="mt-1 text-card-foreground">{diagnostics.strictValidation ? "yes" : "no"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
