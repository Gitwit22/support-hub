import { useState, useEffect } from "react";
import { getUsageMetrics } from "@/lib/api/admin";
import type { UsageMetrics } from "@/lib/types/admin";
import type { UsageItem } from "@/lib/types/program";
import { useProgram } from "@/lib/programs/ProgramContext";
import { BarChart2, Clock } from "lucide-react";

type UsagePeriod = "recent" | "today" | "7d" | "30d" | "all";

const PERIOD_FILTERS: { key: UsagePeriod; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "today",  label: "Today" },
  { key: "7d",     label: "Last 7 Days" },
  { key: "30d",    label: "Last 30 Days" },
  { key: "all",    label: "All Time" },
];

function formatMetricValue(value: number, item: UsageItem): string {
  const formatted = value.toLocaleString();
  return item.type === "duration" && item.unit ? `${formatted} ${item.unit}` : formatted;
}

export default function UsagePage() {
  const { activeProgramId, activeProgram } = useProgram();
  const [period, setPeriod] = useState<UsagePeriod>("today");
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMetrics(null);
    // Re-fetches whenever the active program or period changes.
    // programId is forwarded as X-Program-Id so the backend can scope results.
    getUsageMetrics(period, activeProgramId).then((m) => {
      setMetrics(m);
      setLoading(false);
    });
  }, [period, activeProgramId]);

  const usageItems = activeProgram.usageItems ?? [];
  const cardCount = usageItems.length || 4;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform usage and metering for <span className="font-medium">{activeProgram.name}</span>.
        </p>
      </div>

      {/* Period filter — drives ?period= query param on the API call */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPeriod(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              period === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {usageItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <BarChart2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No usage items configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add usage items when registering or editing this program to see metrics here.
          </p>
        </div>
      ) : loading || !metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cardCount }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {usageItems.map((item) => {
            const raw = metrics[item.key] ?? 0;
            const display = formatMetricValue(raw, item);
            const Icon = item.type === "duration" ? Clock : BarChart2;
            return (
              <div key={item.key} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <Icon className="h-5 w-5 text-primary/60" />
                </div>
                <p className="mt-2 text-3xl font-bold text-card-foreground">{display}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
