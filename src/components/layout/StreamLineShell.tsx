import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, LifeBuoy, HeartPulse, Stethoscope,
  Radio, Bell, BarChart3, Webhook, Settings, Menu, X, FlaskConical,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Support", to: "/admin/support", icon: LifeBuoy },
  { label: "Monitoring", to: "/admin/monitoring", icon: HeartPulse },
  { label: "Diagnostics", to: "/admin/diagnostics", icon: Stethoscope },
  { label: "Rooms", to: "/admin/rooms", icon: Radio },
  { label: "Alerts", to: "/admin/alerts", icon: Bell },
  { label: "Usage", to: "/admin/usage", icon: BarChart3 },
  { label: "Webhooks", to: "/admin/webhooks", icon: Webhook },
  { label: "Settings", to: "/admin/settings", icon: Settings },
  { label: "Beta Testing", to: "/admin/beta-testing", icon: FlaskConical },
];

export default function StreamLineShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-bold text-sidebar-primary-foreground">S</span>
          </div>
          <span className="text-lg font-bold text-sidebar-accent-foreground">StreamLine</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                (isActive || (item.to !== "/admin" && location.pathname.startsWith(item.to)))
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">NL</div>
            <div>
              <p className="text-sm font-medium text-sidebar-accent-foreground">Admin Console</p>
              <p className="text-xs text-sidebar-foreground">Nxt Lvl Technology</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
