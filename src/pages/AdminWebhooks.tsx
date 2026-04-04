import { useState, useEffect } from "react";
import { listWebhooks, getWebhookDeliveryLog } from "@/lib/api/admin";
import type { Webhook, WebhookStatus, WebhookDeliveryLog, WebhookDeliveryStatus } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import {
  Webhook as WebhookIcon, CheckCircle2, XCircle, Pause, Plus,
  Pencil, Trash2, RotateCcw, Eye, EyeOff, Send, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useProgram } from "@/lib/programs/ProgramContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS = [
  "ticket.created", "ticket.updated", "ticket.resolved", "ticket.closed",
  "room.started", "room.ended", "room.participant.joined", "room.participant.left",
  "recording.started", "recording.completed",
  "alert.triggered", "alert.resolved",
  "user.created", "user.updated",
] as const;

const statusConfig: Record<WebhookStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  active:   { label: "Active",   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950", icon: CheckCircle2 },
  failing:  { label: "Failing",  color: "text-destructive",  bg: "bg-red-50 dark:bg-red-950",         icon: XCircle },
  disabled: { label: "Disabled", color: "text-muted-foreground", bg: "bg-muted",                      icon: Pause },
};

const deliveryStatusColor: Record<WebhookDeliveryStatus, string> = {
  success: "text-emerald-600",
  failed:  "text-destructive",
  pending: "text-amber-600",
};

// ---------------------------------------------------------------------------
// Local form state
// ---------------------------------------------------------------------------

interface WebhookFormState {
  url: string;
  events: string[];
}

const EMPTY_FORM: WebhookFormState = { url: "", events: [] };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WebhooksPage() {
  const { activeProgramId, activeProgram } = useProgram();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryLog, setDeliveryLog] = useState<WebhookDeliveryLog | null>(null);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  // Dialog (add / edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [form, setForm] = useState<WebhookFormState>(EMPTY_FORM);

  // Signing-secret visibility toggle per webhook id
  const [secretVisible, setSecretVisible] = useState<Record<string, boolean>>({});

  // Re-fetch whenever the active program changes.
  useEffect(() => {
    setLoading(true);
    setLoadingDeliveries(true);
    setWebhooks([]);
    setDeliveryLog(null);
    listWebhooks(activeProgramId).then((w) => { setWebhooks(w); setLoading(false); });
    getWebhookDeliveryLog({ pageSize: 10, programId: activeProgramId }).then((d) => {
      setDeliveryLog(d);
      setLoadingDeliveries(false);
    });
  }, [activeProgramId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function openAddDialog() {
    setEditingWebhook(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(wh: Webhook) {
    setEditingWebhook(wh);
    setForm({ url: wh.url, events: [...wh.events] });
    setDialogOpen(true);
  }

  /** Local-only toggle until PATCH /admin/webhooks/:id/status is available */
  function toggleEnabled(id: string) {
    setWebhooks((prev) =>
      prev.map((wh) => {
        if (wh.id !== id) return wh;
        const next: WebhookStatus = wh.status === "disabled" ? "active" : "disabled";
        return { ...wh, status: next };
      })
    );
    // TODO: wire to PATCH /admin/webhooks/:id/status
  }

  /** Local-only delete until DELETE /admin/webhooks/:id is available */
  function handleDelete(id: string) {
    setWebhooks((prev) => prev.filter((wh) => wh.id !== id));
    // TODO: wire to DELETE /admin/webhooks/:id
  }

  function toggleFormEvent(ev: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(ev)
        ? prev.events.filter((e) => e !== ev)
        : [...prev.events, ev],
    }));
  }

  /** Local-only save until POST/PUT /admin/webhooks is available */
  function handleSave() {
    if (!form.url.trim()) return;
    if (editingWebhook) {
      setWebhooks((prev) =>
        prev.map((wh) =>
          wh.id === editingWebhook.id
            ? { ...wh, url: form.url.trim(), events: form.events }
            : wh
        )
      );
      // TODO: wire to PUT /admin/webhooks/:id
    } else {
      const newWebhook: Webhook = {
        id: `local-${Date.now()}`,
        url: form.url.trim(),
        events: form.events,
        status: "active",
        failureCount: 0,
        createdAt: new Date().toISOString(),
      };
      setWebhooks((prev) => [newWebhook, ...prev]);
      // TODO: wire to POST /admin/webhooks
    }
    setDialogOpen(false);
  }

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">

      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Webhook destinations, event subscriptions, and delivery history for{" "}
            <span className="font-medium">{activeProgram.name}</span>.
          </p>
        </div>
        <Button onClick={openAddDialog} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* ---- Webhook List ---- */}
      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <WebhookIcon className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No webhooks configured</p>
            <p className="text-xs text-muted-foreground mt-1">Add a webhook to start receiving event notifications.</p>
            <Button onClick={openAddDialog} variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Add Webhook
            </Button>
          </div>
        ) : (
          webhooks.map((wh) => {
            const cfg = statusConfig[wh.status];
            const StatusIcon = cfg.icon;
            const isEnabled = wh.status !== "disabled";
            const showSecret = secretVisible[wh.id] ?? false;

            return (
              <div key={wh.id} className="rounded-lg border border-border bg-card p-5 space-y-4">

                {/* URL + status badge + enable/disable toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <WebhookIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium text-card-foreground truncate font-mono">{wh.url}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {wh.events.map((ev) => (
                        <span key={ev} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleEnabled(wh.id)}
                      aria-label={isEnabled ? "Disable webhook" : "Enable webhook"}
                    />
                  </div>
                </div>

                {/* Delivery meta */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {wh.lastDeliveryAt && (
                    <span>Last delivery: {formatDistanceToNow(new Date(wh.lastDeliveryAt), { addSuffix: true })}</span>
                  )}
                  {wh.lastStatusCode !== undefined && wh.lastStatusCode > 0 && (
                    <span>HTTP {wh.lastStatusCode}</span>
                  )}
                  {wh.failureCount > 0 && (
                    <span className="text-destructive font-medium">
                      {wh.failureCount} failure{wh.failureCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span>Created {formatDistanceToNow(new Date(wh.createdAt), { addSuffix: true })}</span>
                </div>

                <Separator />

                {/* Signing secret + action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <code className="text-xs text-muted-foreground font-mono select-none">
                      {showSecret ? "whsec_••••••••••••••••••••••••••••••" : "••••••••••••••••••••••••••••••••"}
                    </code>
                    <button
                      onClick={() => setSecretVisible((prev) => ({ ...prev, [wh.id]: !prev[wh.id] }))}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showSecret ? "Hide secret" : "Show secret"}
                    >
                      {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    {/* TODO: wire to POST /admin/webhooks/:id/secret/regenerate */}
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* TODO: wire to POST /admin/webhooks/:id/test */}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Send className="h-3 w-3" />
                      Test Send
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openEditDialog(wh)}>
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(wh.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ---- Delivery Log ---- */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recent Deliveries</h2>
          <p className="text-sm text-muted-foreground">Latest delivery attempts across all webhook endpoints.</p>
        </div>

        {loadingDeliveries ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !deliveryLog || deliveryLog.deliveries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No delivery history available.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {deliveryLog.deliveries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${deliveryStatusColor[entry.status]}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.eventName}</span>
                      {entry.statusCode && (
                        <span className="text-xs text-muted-foreground">HTTP {entry.statusCode}</span>
                      )}
                      {entry.attempt > 1 && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          Attempt {entry.attempt}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{entry.url}</p>
                    {entry.error && (
                      <p className="text-xs text-destructive mt-0.5">{entry.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                    {/* TODO: wire to POST /admin/webhooks/deliveries/:id/retry */}
                    {entry.status === "failed" && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {deliveryLog.total > deliveryLog.deliveries.length && (
              <div className="border-t border-border px-5 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Showing {deliveryLog.deliveries.length} of {deliveryLog.total} deliveries
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Add / Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? "Edit Webhook" : "Add Webhook"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-app.com/webhooks"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Event Subscriptions</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border p-3 space-y-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <div key={ev} className="flex items-center gap-2">
                    <Checkbox
                      id={`event-${ev}`}
                      checked={form.events.includes(ev)}
                      onCheckedChange={() => toggleFormEvent(ev)}
                    />
                    <label htmlFor={`event-${ev}`} className="text-sm font-mono cursor-pointer select-none">
                      {ev}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {!editingWebhook && (
              <p className="text-xs text-muted-foreground">
                A signing secret will be auto-generated once the webhook is persisted.
                Backend wiring required for full persistence.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.url.trim()}>
              {editingWebhook ? "Save Changes" : "Add Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
