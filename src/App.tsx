import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import StreamLineShell from "./components/layout/StreamLineShell.tsx";
import EduSupportPage from "./pages/EduSupport.tsx";
import AdminSupportPage from "./pages/AdminSupport.tsx";
import SupportConsolePage from "./pages/SupportConsole.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<StreamLineShell />}>
            <Route path="/" element={<Index />} />
            <Route path="/streamline/edu/support" element={<EduSupportPage />} />
            <Route path="/streamline/admin/support" element={<AdminSupportPage />} />
            <Route path="/support-console" element={<SupportConsolePage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
