import { useState, useEffect } from "react";
import { getAdminDashboardSummary } from "@/lib/api/admin";
import type { AdminDashboardSummary, ServiceStatus } from "@/lib/types/admin";
import { useProgram } from "@/lib/programs/ProgramContext";
import {
  TicketCheck, AlertTriangle, Radio, HeartPulse, Bell,
  Users, CalendarDays, LayoutDashboard,
} from "lucide-react";

const statusColor: Record<ServiceStatus, string> = {
  healthy: "text-emerald-500",
  degraded: "text-amber-500",
  down: "text-destructive",
  unknown: "text-muted-foreground",
};

const statusLabel: Record<ServiceStatus, string> = {
  healthy: "All Systems Healthy",
  degraded: "Degraded",
  down: "Outage Detected",
  unknown: "Unknown",
};

export default function AdminDashboardPage() {
  const { activeProgram } = useProgram();
  const [data, setData] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const supportsDashboard = Boolean(activeProgram.endpoints.dashboard);

  useEffect(() => {
    if (!supportsDashboard) { setLoading(false); return; }
    setLoading(true);
    getAdminDashboardSummary().then((d) => { setData(d); setLoading(false); });
  }, [activeProgram.id, supportsDashboard]);

  if (!supportsDashboard) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Operations overview for {activeProgram.name}.</p>
        </div>
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <LayoutDashboard className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Dashboard not configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeProgram.name} does not expose a dashboard summary endpoint. Add{" "}
            <span className="font-medium">endpoints.dashboard</span> to the program config to enable this view.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Open Tickets", value: data.openTickets, icon: TicketCheck, color: "text-blue-500" },
    { label: "Urgent Tickets", value: data.urgentTickets, icon: AlertTriangle, color: "text-destructive" },
    { label: "Active Rooms", value: data.activeRooms, icon: Radio, color: "text-violet-500" },
    { label: "Service Health", value: statusLabel[data.overallHealth], icon: HeartPulse, color: statusColor[data.overallHealth], isText: true },
    { label: "Active Alerts", value: data.activeAlerts, icon: Bell, color: "text-amber-500" },
    { label: "Tickets Today", value: data.ticketsToday, icon: CalendarDays, color: "text-sky-500" },
    { label: "Active Users", value: data.activeUsers.toLocaleString(), icon: Users, color: "text-emerald-500", isText: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Operations overview for {activeProgram.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className={`mt-2 ${card.isText ? "text-lg" : "text-3xl"} font-bold text-card-foreground`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
