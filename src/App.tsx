import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import StreamLineShell from "./components/layout/StreamLineShell.tsx";
import SupportConsolePage from "./pages/SupportConsole.tsx";
import AdminDashboardPage from "./pages/AdminDashboard.tsx";
import MonitoringPage from "./pages/AdminMonitoring.tsx";
import DiagnosticsPage from "./pages/AdminDiagnostics.tsx";
import RoomsPage from "./pages/AdminRooms.tsx";
import AlertsPage from "./pages/AdminAlerts.tsx";
import UsagePage from "./pages/AdminUsage.tsx";
import WebhooksPage from "./pages/AdminWebhooks.tsx";
import AdminSettingsPage from "./pages/AdminSettings.tsx";
import BetaTestingPage from "./pages/BetaTesting.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<StreamLineShell />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/support" element={<SupportConsolePage />} />
            <Route path="/admin/monitoring" element={<MonitoringPage />} />
            <Route path="/admin/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/admin/rooms" element={<RoomsPage />} />
            <Route path="/admin/alerts" element={<AlertsPage />} />
            <Route path="/admin/usage" element={<UsagePage />} />
            <Route path="/admin/webhooks" element={<WebhooksPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/beta-testing" element={<BetaTestingPage />} />
          </Route>
          {/* Legacy routes redirect to admin console */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/support-console" element={<Navigate to="/admin/support" replace />} />
          <Route path="/streamline/admin/support" element={<Navigate to="/admin/support" replace />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
