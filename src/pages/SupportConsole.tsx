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
  addTicketMessage, closeTicket, getCurrentUser,
} from "@/lib/api/support";
import type { CurrentUser, Ticket, TicketFilters } from "@/lib/types/support";
import { AlertTriangle, LayoutDashboard, LifeBuoy, List, Plus, Users } from "lucide-react";
import { useProgram } from "@/lib/programs/ProgramContext";

export default function SupportConsolePage() {
  const { activeProgram } = useProgram();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [masterTickets, setMasterTickets] = useState<Ticket[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterLoading, setMasterLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>({});

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const data = await listTickets(filters);
    setTickets(data);
    setLoading(false);
  }, [filters]);

  const fetchMasterTickets = useCallback(async () => {
    setMasterLoading(true);
    const data = await listTickets();
    setMasterTickets(data);
    setMasterLoading(false);
  }, []);

  const fetchLoggedInUser = useCallback(async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  }, []);

  const supportsTickets = Boolean(activeProgram.endpoints.tickets);

  useEffect(() => { if (supportsTickets) fetchTickets(); else setLoading(false); }, [fetchTickets, supportsTickets]);
  useEffect(() => { if (supportsTickets) fetchMasterTickets(); else setMasterLoading(false); }, [fetchMasterTickets, supportsTickets]);
  useEffect(() => { if (supportsTickets) fetchLoggedInUser(); }, [fetchLoggedInUser, supportsTickets]);

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
    fetchMasterTickets();
  };

  const handleReply = async (ticketId: string, payload: Parameters<typeof addTicketMessage>[1]) => {
    await addTicketMessage(ticketId, payload);
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
    fetchMasterTickets();
  };

  const handleUpdate = async (ticketId: string, payload: Parameters<typeof updateTicket>[1]) => {
    await updateTicket(ticketId, payload);
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
    fetchMasterTickets();
  };

  const handleClose = async (ticketId: string) => {
    await closeTicket(ticketId);
    const updated = await getTicket(ticketId);
    if (updated) setSelectedTicket(updated);
    fetchTickets();
    fetchMasterTickets();
  };

  const activeErrorStatuses = new Set(["open", "in_progress", "waiting"]);

  const userErrorSummary = Object.values(
    masterTickets.reduce<Record<string, {
      userId: string;
      userName: string;
      userEmail: string;
      totalErrors: number;
      openErrors: number;
      urgentErrors: number;
      lastSeenAt: string;
    }>>((acc, ticket) => {
      const key = ticket.userId || ticket.userEmail || ticket.userName;
      if (!acc[key]) {
        acc[key] = {
          userId: ticket.userId || "-",
          userName: ticket.userName || "-",
          userEmail: ticket.userEmail || "-",
          totalErrors: 0,
          openErrors: 0,
          urgentErrors: 0,
          lastSeenAt: ticket.updatedAt,
        };
      }

      const row = acc[key];
      row.totalErrors += 1;
      if (activeErrorStatuses.has(ticket.status)) row.openErrors += 1;
      if (ticket.priority === "urgent" && activeErrorStatuses.has(ticket.status)) row.urgentErrors += 1;
      if (new Date(ticket.updatedAt).getTime() > new Date(row.lastSeenAt).getTime()) {
        row.lastSeenAt = ticket.updatedAt;
      }

      return acc;
    }, {})
  ).sort((a, b) => b.totalErrors - a.totalErrors);

  const masterErrorRows = [...masterTickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!supportsTickets) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support Console</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage support tickets across all Nxt Lvl Technology products.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Ticket API not configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeProgram.name} does not expose a ticket management endpoint.{" "}
            Add <span className="font-medium">endpoints.tickets</span> to the program config to enable this view.
            For StreamLine, use the <span className="font-medium">Rooms</span> page for live support sessions.
          </p>
        </div>
      </div>
    );
  }

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

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Logged In</p>
            <p className="text-sm font-semibold text-card-foreground mt-1">{currentUser?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.email || "-"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
            <p className="text-sm text-card-foreground mt-1">{currentUser?.role || "-"}</p>
            <p className="text-xs text-muted-foreground">School: {currentUser?.school || "-"}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setSelectedTicket(null); setShowComposer(false); }}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-card">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5 data-[state=active]:bg-card">
            <List className="h-4 w-4" /> All Tickets
          </TabsTrigger>
          <TabsTrigger value="master-errors" className="gap-1.5 data-[state=active]:bg-card">
            <AlertTriangle className="h-4 w-4" /> Master Errors
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

        <TabsContent value="master-errors" className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-card-foreground">Errors By User</h3>
            </div>
            {masterLoading ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : userErrorSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Open</th>
                      <th className="py-2 pr-3">Urgent</th>
                      <th className="py-2">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userErrorSummary.map((row) => (
                      <tr key={`${row.userId}-${row.userEmail}`} className="border-b border-border/50">
                        <td className="py-2 pr-3 text-card-foreground">{row.userName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{row.userEmail}</td>
                        <td className="py-2 pr-3 text-card-foreground">{row.totalErrors}</td>
                        <td className="py-2 pr-3 text-card-foreground">{row.openErrors}</td>
                        <td className="py-2 pr-3 text-card-foreground">{row.urgentErrors}</td>
                        <td className="py-2 text-muted-foreground">{new Date(row.lastSeenAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-card-foreground">Master Error List</h3>
            </div>
            {masterLoading ? (
              <p className="text-sm text-muted-foreground">Loading errors...</p>
            ) : masterErrorRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">Ticket #</th>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Priority</th>
                      <th className="py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterErrorRows.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                        onClick={() => handleSelectTicket(ticket)}
                      >
                        <td className="py-2 pr-3 font-mono text-muted-foreground">{ticket.ticketNumber}</td>
                        <td className="py-2 pr-3 text-card-foreground">{ticket.userName || "-"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{ticket.userEmail || "-"}</td>
                        <td className="py-2 pr-3 text-card-foreground">{ticket.title}</td>
                        <td className="py-2 pr-3 text-card-foreground">{ticket.status}</td>
                        <td className="py-2 pr-3 text-card-foreground">{ticket.priority}</td>
                        <td className="py-2 text-muted-foreground">{new Date(ticket.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
