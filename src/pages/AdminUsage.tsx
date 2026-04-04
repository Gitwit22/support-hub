import { useState, useEffect } from "react";
import { getUsageMetrics } from "@/lib/api/admin";
import type { UsageMetrics } from "@/lib/types/admin";
import {
  TicketCheck, Users, Radio, MessageSquare, Clock, Zap,
  Video, Tv,
} from "lucide-react";

type UsagePeriod = "recent" | "today" | "7d" | "30d" | "all";

const PERIOD_FILTERS: { key: UsagePeriod; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "today",  label: "Today" },
  { key: "7d",     label: "Last 7 Days" },
  { key: "30d",    label: "Last 30 Days" },
  { key: "all",    label: "All Time" },
];

export default function UsagePage() {
  const [period, setPeriod] = useState<UsagePeriod>("today");
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // period is passed as a query param; client-side fallback returns the same
    // aggregate snapshot until the backend supports period-scoped metrics.
    getUsageMetrics(period).then((m) => { setMetrics(m); setLoading(false); });
  }, [period]);

  const cards = metrics ? [
    { label: "Tickets",            value: metrics.ticketsToday,                icon: TicketCheck,   color: "text-blue-500" },
    { label: "Active Users",       value: metrics.activeUsers.toLocaleString(),  icon: Users,         color: "text-emerald-500" },
    { label: "Rooms Created",      value: metrics.roomsCreated,                icon: Radio,         color: "text-violet-500" },
    { label: "Messages Sent",      value: metrics.messagesSent.toLocaleString(), icon: MessageSquare, color: "text-sky-500" },
    { label: "Stream Minutes",     value: metrics.streamMinutes.toLocaleString(), icon: Clock,        color: "text-amber-500" },
    { label: "API Requests",       value: metrics.apiRequests.toLocaleString(),  icon: Zap,           color: "text-orange-500" },
    { label: "Recordings",         value: metrics.recordingsCreated,            icon: Video,         color: "text-pink-500" },
    { label: "HLS Minutes",        value: metrics.hlsMinutes.toLocaleString(),  icon: Tv,            color: "text-indigo-500" },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform usage and metering overview.</p>
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

      {loading || !metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="mt-2 text-3xl font-bold text-card-foreground">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
