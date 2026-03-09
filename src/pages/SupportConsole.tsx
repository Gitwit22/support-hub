import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SupportDashboard } from "@/components/support/SupportDashboard";
import { SupportTicketList } from "@/components/support/SupportTicketList";
import { SupportTicketFilters } from "@/components/support/SupportTicketFilters";
import { SupportTicketDetail } from "@/components/support/SupportTicketDetail";
import { SupportTicketComposer } from "@/components/support/SupportTicketComposer";
import {
  listTickets, getTicket, createTicket, updateTicket,
  addTicketMessage, closeTicket,
} from "@/lib/api/support";
import type { Ticket, TicketFilters } from "@/lib/types/support";
import { LayoutDashboard, List, Plus } from "lucide-react";

export default function SupportConsolePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>({});

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const data = await listTickets(filters);
    setTickets(data);
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSelectTicket = async (ticket: Ticket) => {
    const full = await getTicket(ticket.id);
    if (full) {
      setSelectedTicket(full);
      setActiveTab("tickets");
    }
  };

  const handleCreateTicket = async (payload: Parameters<typeof createTicket>[0]) => {
    await createTicket(payload);
    setShowComposer(false);
    fetchTickets();
  };

  const handleReply = async (ticketId: string, payload: Parameters<typeof addTicketMessage>[1]) => {
    await addTicketMessage(ticketId, payload);
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
  };

  const handleUpdate = async (ticketId: string, payload: Parameters<typeof updateTicket>[1]) => {
    await updateTicket(ticketId, payload);
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
  };

  const handleClose = async (ticketId: string) => {
    await closeTicket(ticketId);
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
  };

  // Ticket detail view
  if (selectedTicket) {
    return (
      <div className="mx-auto max-w-4xl">
        <SupportTicketDetail
          ticket={selectedTicket}
          onBack={() => setSelectedTicket(null)}
          onReply={handleReply}
          onUpdate={handleUpdate}
          onClose={handleClose}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Console</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage support tickets across all Nxt Lvl Technology products.
          </p>
        </div>
        <Button onClick={() => { setActiveTab("tickets"); setShowComposer(true); }} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> New Ticket
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setSelectedTicket(null); setShowComposer(false); }}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-card">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5 data-[state=active]:bg-card">
            <List className="h-4 w-4" /> All Tickets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <SupportDashboard />
        </TabsContent>

        <TabsContent value="tickets" className="mt-6 space-y-4">
          <SupportTicketFilters filters={filters} onChange={setFilters} />
          {showComposer && (
            <SupportTicketComposer onSubmit={handleCreateTicket} onCancel={() => setShowComposer(false)} />
          )}
          <SupportTicketList
            tickets={tickets}
            onSelect={handleSelectTicket}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
