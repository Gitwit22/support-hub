// ---------------------------------------------------------------------------
// ConnectionVerifier — proves a program is really linked to monitoring:
// its health checks answer, and it has delivered telemetry with an active key.
// While telemetry hasn't arrived yet it keeps watching (read-only, no extra
// health polling) so the user can deploy the env vars and see it flip.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyConnection, type ConnectionReport } from "@/lib/api/monitoring";
import { cn } from "@/lib/utils";

const WATCH_INTERVAL_MS = 10_000;
const WATCH_LIMIT_MS = 15 * 60_000;

const VERDICT_STYLES: Record<ConnectionReport["verdict"], { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800" },
  partial: { label: "Partially connected", className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" },
  not_connected: { label: "Not connected", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800" },
};

const STEP_LABELS: Record<string, string> = {
  health: "Health checks answer",
  telemetry: "App is sending telemetry",
};

interface ConnectionVerifierProps {
  environmentId: string;
  /** Run every health check immediately on mount (otherwise show the latest recorded state). */
  runOnMount?: boolean;
}

export function ConnectionVerifier({ environmentId, runOnMount = false }: ConnectionVerifierProps) {
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [watching, setWatching] = useState(false);
  const watchStartedAt = useRef<number>(0);

  const load = useCallback(
    async (runChecks: boolean) => {
      if (runChecks) setRunning(true);
      try {
        const next = await verifyConnection(environmentId, { runChecks });
        setReport(next);
        setError(null);
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
        return null;
      } finally {
        if (runChecks) setRunning(false);
      }
    },
    [environmentId],
  );

  useEffect(() => {
    void load(runOnMount).then((first) => {
      if (first && !first.steps.find((s) => s.id === "telemetry")?.ok) {
        watchStartedAt.current = Date.now();
        setWatching(true);
      }
    });
  }, [load, runOnMount]);

  // Watch for the app's first event without re-running health checks.
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(async () => {
      const next = await load(false);
      const telemetryOk = next?.steps.find((s) => s.id === "telemetry")?.ok;
      if (telemetryOk || Date.now() - watchStartedAt.current > WATCH_LIMIT_MS) setWatching(false);
    }, WATCH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [watching, load]);

  const verdict = report ? VERDICT_STYLES[report.verdict] : null;

  return (
    <div className="space-y-3" data-testid="connection-verifier">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Connection</span>
          {verdict ? (
            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", verdict.className)} data-testid="connection-verdict">
              {verdict.label}
            </span>
          ) : (
            !error && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void load(true)} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Run checks now
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {report && (
        <>
          <ul className="space-y-1.5 text-sm">
            {report.steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2">
                {step.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                ) : step.id === "telemetry" && watching ? (
                  <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                )}
                <span>
                  {STEP_LABELS[step.id] ?? step.id}
                  <span className="block text-xs text-muted-foreground">{step.detail}</span>
                  {step.id === "telemetry" && !step.ok && watching && (
                    <span className="block text-xs text-muted-foreground">Watching for the first event…</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {report.healthChecks.length > 0 && (
            <div className="rounded-md border border-border divide-y divide-border text-xs">
              {report.healthChecks.map((check) => (
                <div key={check.id} className="flex items-start gap-2 px-2.5 py-1.5">
                  {check.status === "up" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
                  ) : check.status === "degraded" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                  ) : check.status === "down" ? (
                    <XCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/50 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium">{check.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {check.status === "not_run"
                        ? "not run yet"
                        : `${check.status}${check.httpStatus ? ` · HTTP ${check.httpStatus}` : ""}${check.latencyMs !== null ? ` · ${check.latencyMs}ms` : ""}`}
                    </span>
                    {check.errorMessage && <span className="block text-destructive break-words">{check.errorMessage}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
