import { useState, useEffect, useCallback } from "react";
import { TicketList } from "@/components/support/TicketList";
import { TicketDetail } from "@/components/support/TicketDetail";
import { SupportFilters } from "@/components/support/SupportFilters";
import { listTickets, getTicket, updateTicket, addTicketMessage, closeTicket, setCurrentUserKey } from "@/lib/api/support";
import type { Ticket, TicketFilters } from "@/lib/types/support";

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filters, setFilters] = useState<TicketFilters>({});

  // Set admin context
  useEffect(() => { setCurrentUserKey("admin"); return () => setCurrentUserKey("teacher"); }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const data = await listTickets(filters);
    setTickets(data);
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSelectTicket = async (ticket: Ticket) => {
    const full = await getTicket(ticket.id);
    if (full) setSelectedTicket(full);
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

  if (selectedTicket) {
    return (
      <div className="mx-auto max-w-4xl">
        <TicketDetail
          ticket={selectedTicket}
          onBack={() => setSelectedTicket(null)}
          onReply={handleReply}
          onUpdate={handleUpdate}
          onClose={handleClose}
          isAdmin
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Support Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all incoming EDU support tickets.</p>
      </div>
      <SupportFilters filters={filters} onChange={setFilters} />
      <TicketList tickets={tickets} onSelect={handleSelectTicket} loading={loading} showSchool emptyMessage="No tickets found" />
    </div>
  );
}
