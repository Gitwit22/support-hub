import { useState, useEffect, useCallback, useMemo } from "react";
import { TicketDetail } from "@/components/support/TicketDetail";
import { AdminTicketFilters } from "@/components/support/AdminTicketFilters";
import { AdminTicketList } from "@/components/support/AdminTicketList";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { listTickets, getTicket, updateTicket, addTicketMessage, closeTicket, setCurrentUserKey } from "@/lib/api/support";
import type { Ticket, TicketFilters } from "@/lib/types/support";
import { AlertCircle, AlertTriangle, Clock, Inbox } from "lucide-react";

export default function AdminSupportPage() {
  const [allEduTickets, setAllEduTickets] = useState<Ticket[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filters, setFilters] = useState<TicketFilters>({});

  // Set admin context
  useEffect(() => {
    setCurrentUserKey("admin");
    return () => setCurrentUserKey("teacher");
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    // Always scope to streamline-edu
    const eduFilters: TicketFilters = { ...filters, product: "streamline-edu" };
    const data = await listTickets(eduFilters);
    setTickets(data);
    setLoading(false);
  }, [filters]);

  // Fetch all EDU tickets (unfiltered) for summary stats and school list
  const fetchAllEdu = useCallback(async () => {
    const data = await listTickets({ product: "streamline-edu" });
    setAllEduTickets(data);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { fetchAllEdu(); }, [fetchAllEdu]);

  // Derive summary stats from unfiltered EDU tickets
  const stats = useMemo(() => {
    const open = allEduTickets.filter(t => t.status === "open").length;
    const activeStatuses = ["open", "in_progress", "waiting"];
    const urgent = allEduTickets.filter(t => t.priority === "urgent" && activeStatuses.includes(t.status)).length;
    const waiting = allEduTickets.filter(t => t.status === "waiting").length;
    return { open, urgent, waiting, total: allEduTickets.length };
  }, [allEduTickets]);

  // Unique school IDs for the filter dropdown
  const schoolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of allEduTickets) {
      if (t.schoolId) ids.add(t.schoolId);
    }
    return Array.from(ids).sort();
  }, [allEduTickets]);

  const handleSelectTicket = async (ticket: Ticket) => {
    const full = await getTicket(ticket.id);
    if (full) setSelectedTicket(full);
  };

  const refreshAfterAction = async (ticketId: string) => {
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
    fetchAllEdu();
  };

  const handleReply = async (ticketId: string, payload: Parameters<typeof addTicketMessage>[1]) => {
    await addTicketMessage(ticketId, payload);
    await refreshAfterAction(ticketId);
  };

  const handleUpdate = async (ticketId: string, payload: Parameters<typeof updateTicket>[1]) => {
    await updateTicket(ticketId, payload);
    await refreshAfterAction(ticketId);
  };

  const handleClose = async (ticketId: string) => {
    await closeTicket(ticketId);
    await refreshAfterAction(ticketId);
  };

  const summaryCards = [
    { label: "Open", value: stats.open, icon: AlertCircle, color: "text-info" },
    { label: "Urgent", value: stats.urgent, icon: AlertTriangle, color: "text-destructive" },
    { label: "Waiting on User", value: stats.waiting, icon: Clock, color: "text-warning" },
    { label: "Total EDU", value: stats.total, icon: Inbox, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">EDU Support Console</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage incoming StreamLine EDU support tickets.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map(card => (
          <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="mt-1 text-2xl font-bold text-card-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <AdminTicketFilters filters={filters} onChange={setFilters} schoolIds={schoolIds} />

      {/* Split-pane layout — desktop only */}
      <div className="hidden lg:block">
        {selectedTicket ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border border-border">
            <ResizablePanel id="ticket-list" order={1} defaultSize={40} minSize={30}>
              <div className="h-full overflow-auto">
                <AdminTicketList
                  tickets={tickets}
                  onSelect={handleSelectTicket}
                  selectedTicketId={selectedTicket.id}
                  loading={loading}
                  emptyMessage="No EDU tickets match your filters"
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="ticket-detail" order={2} defaultSize={60} minSize={35}>
              <div className="h-full overflow-auto p-6">
                <TicketDetail
                  ticket={selectedTicket}
                  onBack={() => setSelectedTicket(null)}
                  onReply={handleReply}
                  onUpdate={handleUpdate}
                  onClose={handleClose}
                  isAdmin
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <AdminTicketList
            tickets={tickets}
            onSelect={handleSelectTicket}
            loading={loading}
            emptyMessage="No EDU tickets match your filters"
          />
        )}
      </div>

      {/* Mobile stacked layout */}
      <div className="lg:hidden">
        {selectedTicket ? (
          <TicketDetail
            ticket={selectedTicket}
            onBack={() => setSelectedTicket(null)}
            onReply={handleReply}
            onUpdate={handleUpdate}
            onClose={handleClose}
            isAdmin
          />
        ) : (
          <AdminTicketList
            tickets={tickets}
            onSelect={handleSelectTicket}
            loading={loading}
            emptyMessage="No EDU tickets match your filters"
          />
        )}
      </div>
    </div>
  );
}
