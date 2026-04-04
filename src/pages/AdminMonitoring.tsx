import { useState, useEffect } from "react";
import { getMonitoringOverview } from "@/lib/api/admin";
import type { MonitoringOverview, ServiceStatus } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import {
  fetchSupportStatus,
  getStreamlineDiagnostics,
  isStreamlineConfigured,
  isStreamlineValidationError,
} from "@/services/streamlineApi";
import { useProgram } from "@/lib/programs/ProgramContext";

const statusConfig: Record<ServiceStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  healthy:  { label: "Healthy",  color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950", icon: CheckCircle2 },
  degraded: { label: "Degraded", color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950",     icon: AlertTriangle },
  down:     { label: "Down",     color: "text-destructive",  bg: "bg-red-50 dark:bg-red-950",         icon: XCircle },
  unknown:  { label: "Unknown",  color: "text-muted-foreground", bg: "bg-muted", icon: HelpCircle },
};

export default function MonitoringPage() {
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [diagnosticsText, setDiagnosticsText] = useState<string[]>([]);
  const { activeProgram } = useProgram();

  // Determine whether to use the StreamLine direct API or the fallback admin API.
  // For the StreamLine seed specifically, we honour the env-var driven configuration
  // exactly as before so nothing is lost.  For other programs we use the admin fallback.
  const isStreamlineProgram = activeProgram.slug === "streamline";

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      try {
        if (isStreamlineProgram && isStreamlineConfigured()) {
          // StreamLine: use the direct StreamLine API (existing behaviour).
          const status = await fetchSupportStatus();
          if (!mounted) return;

          setIsConnected(status.connected);
          setConnectionError(null);
          setDiagnosticsText([]);
          setOverview({
            overallStatus: status.status,
            checkedAt: status.checkedAt,
            services: [
              {
                name: `${activeProgram.name} Support API`,
                status: status.status,
                checkedAt: status.checkedAt,
                message: status.message,
              },
            ],
          });
        } else {
          // All other programs (or StreamLine without env vars): fall back to the
          // shared admin monitoring endpoint.
          const fallback = await getMonitoringOverview();
          if (!mounted) return;

          setOverview(fallback);
          setIsConnected(
            fallback.services.length > 0 && fallback.overallStatus !== "down"
          );
          setConnectionError(null);
          if (fallback.services.length === 0) {
            setDiagnosticsText([
              `Program: ${activeProgram.name}`,
              "Source: default",
              "Endpoint: /admin/monitoring",
              "Status Code: -",
              "Error Type: no-data",
              "Error: No monitoring data returned",
            ]);
          } else {
            setDiagnosticsText([]);
          }
        }
      } catch (error) {
        if (!mounted) return;

        const now = new Date().toISOString();
        const message = isStreamlineValidationError(error)
          ? `${activeProgram.name} returned unexpected data`
          : `${activeProgram.name} connection unavailable`;

        setIsConnected(false);
        setConnectionError(message);

        if (isStreamlineProgram) {
          const d = getStreamlineDiagnostics();
          const lines = [
            `Base URL: ${d.baseUrl || "-"}`,
            `Source: ${d.supportDataSource || "-"}`,
            `Endpoint: ${d.lastEndpoint || "-"}`,
            `Status Code: ${d.lastStatusCode ?? "-"}`,
            `Error Type: ${d.lastErrorType || "-"}`,
            `Error: ${d.lastErrorMessage || "-"}`,
          ];
          if (d.lastValidationDetails?.length) {
            lines.push(`Validation: ${d.lastValidationDetails.join(" | ")}`);
          }
          setDiagnosticsText(lines);
        } else {
          setDiagnosticsText([
            `Program: ${activeProgram.name}`,
            `API Base: ${activeProgram.apiBaseUrl || "-"}`,
            `Error: ${message}`,
          ]);
        }

        setOverview({
          overallStatus: "down",
          checkedAt: now,
          services: [
            {
              name: `${activeProgram.name} Support API`,
              status: "down",
              checkedAt: now,
              message,
            },
          ],
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    loadStatus();

    return () => {
      mounted = false;
    };
  }, [activeProgram, isStreamlineProgram]);

  if (loading || !overview) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Monitoring</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const overall = statusConfig[overview.overallStatus];
  const services = overview.services.length > 0
    ? overview.services
    : [{
        name: "Monitoring Data",
        status: "unknown" as ServiceStatus,
        checkedAt: overview.checkedAt,
        message: "No monitoring data returned",
      }];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Service health for <span className="font-medium">{activeProgram.name}</span>.
          </p>
          <p className={`mt-2 text-sm ${isConnected ? "text-emerald-600" : "text-destructive"}`}>
            {isConnected ? "● Connected" : "● Disconnected"}
          </p>
          {connectionError && (
            <p className="mt-1 text-sm text-destructive">{connectionError}</p>
          )}
          {connectionError && diagnosticsText.length > 0 && (
            <div className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground space-y-1">
              {diagnosticsText.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${overall.bg}`}>
          <HeartPulse className={`h-4 w-4 ${overall.color}`} />
          <span className={`text-sm font-semibold ${overall.color}`}>{overall.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const cfg = statusConfig[svc.status];
          const StatusIcon = cfg.icon;
          return (
            <div key={svc.name} className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-card-foreground">{svc.name}</h3>
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {cfg.label}
                </div>
              </div>
              {svc.message && (
                <p className="text-sm text-muted-foreground">{svc.message}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {svc.latencyMs !== undefined && <span>Latency: {svc.latencyMs}ms</span>}
                <span>Checked {formatDistanceToNow(new Date(svc.checkedAt), { addSuffix: true })}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
