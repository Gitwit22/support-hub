import { useState, useEffect } from "react";
import { listWebhooks } from "@/lib/api/admin";
import type { Webhook, WebhookStatus } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { Webhook as WebhookIcon, CheckCircle2, XCircle, Pause } from "lucide-react";

const statusConfig: Record<WebhookStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  active:   { label: "Active",   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950", icon: CheckCircle2 },
  failing:  { label: "Failing",  color: "text-destructive",  bg: "bg-red-50 dark:bg-red-950",         icon: XCircle },
  disabled: { label: "Disabled", color: "text-muted-foreground", bg: "bg-muted",                      icon: Pause },
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWebhooks().then((w) => { setWebhooks(w); setLoading(false); });
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
        <p className="text-sm text-muted-foreground mt-1">Webhook destinations, delivery status, and retry state.</p>
      </div>

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="text-center py-8">
            <WebhookIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No webhooks configured.</p>
          </div>
        ) : (
          webhooks.map((wh) => {
            const cfg = statusConfig[wh.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={wh.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <WebhookIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium text-card-foreground truncate font-mono">{wh.url}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {wh.events.map((ev) => (
                        <span key={ev} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {wh.lastDeliveryAt && (
                    <span>Last delivery: {formatDistanceToNow(new Date(wh.lastDeliveryAt), { addSuffix: true })}</span>
                  )}
                  {wh.lastStatusCode !== undefined && wh.lastStatusCode > 0 && (
                    <span>HTTP {wh.lastStatusCode}</span>
                  )}
                  {wh.failureCount > 0 && (
                    <span className="text-destructive font-medium">{wh.failureCount} failure{wh.failureCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
