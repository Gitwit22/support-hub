import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SupportTabs } from "@/components/support/SupportTabs";
import { TicketList } from "@/components/support/TicketList";
import { TicketDetail } from "@/components/support/TicketDetail";
import { TicketComposer } from "@/components/support/TicketComposer";
import { ReportForm } from "@/components/support/ReportForm";
import { ResponseInbox } from "@/components/support/ResponseInbox";
import { SupportFilters } from "@/components/support/SupportFilters";
import { Button } from "@/components/ui/button";
import { listMyTickets, getTicket, createTicket, addTicketMessage, submitReportAsTicket } from "@/lib/api/eduSupport";
import type { Ticket, TicketFilters } from "@/lib/types/support";
import { Plus } from "lucide-react";

export default function EduSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "tickets";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>({});

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const data = await listMyTickets(filters);
    setTickets(data);
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    setSelectedTicket(null);
    setShowComposer(false);
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    const full = await getTicket(ticket.id);
    if (full) setSelectedTicket(full);
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

  const handleSubmitReport = async (payload: Parameters<typeof submitReportAsTicket>[0]) => {
    await submitReportAsTicket(payload);
    fetchTickets();
  };

  if (selectedTicket) {
    return (
      <div className="mx-auto max-w-4xl">
        <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} onReply={handleReply} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Get help, report issues, and track responses.</p>
      </div>

      <SupportTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        ticketsContent={
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <SupportFilters filters={filters} onChange={setFilters} />
              {!showComposer && (
                <Button onClick={() => setShowComposer(true)} className="shrink-0">
                  <Plus className="mr-1 h-4 w-4" /> Open Ticket
                </Button>
              )}
            </div>
            {showComposer && <TicketComposer onSubmit={handleCreateTicket} onCancel={() => setShowComposer(false)} />}
            <TicketList tickets={tickets} onSelect={handleSelectTicket} loading={loading} emptyMessage="No tickets yet" emptyAction={
              <Button onClick={() => setShowComposer(true)}>Open your first ticket</Button>
            } />
          </div>
        }
        reportsContent={
          <div className="mt-4 mx-auto max-w-2xl">
            <ReportForm onSubmit={handleSubmitReport} />
          </div>
        }
        responsesContent={
          <div className="mt-4">
            <ResponseInbox tickets={tickets} onSelect={handleSelectTicket} loading={loading} />
          </div>
        }
      />
    </div>
  );
}
