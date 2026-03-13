// ---------------------------------------------------------------------------
// Streamline webhook dispatcher – HMAC-signed HTTP delivery with configurable
// retries, timeouts, and Firestore webhookDeliveries logging (via API).
// ---------------------------------------------------------------------------

import { apiFetch } from "@/lib/api/client";
import type { StreamlineEventPayload } from "./eventTypes";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface WebhookDispatcherConfig {
  /** Maximum number of delivery attempts (default: 3). */
  maxRetries: number;
  /** Per-request timeout in milliseconds (default: 10 000). */
  timeoutMs: number;
  /** Base delay between retries in ms – actual delay is base × 2^attempt (default: 1000). */
  retryBaseDelayMs: number;
  /** HMAC secret used to sign payloads (hex-encoded). */
  hmacSecret: string;
}

const DEFAULT_CONFIG: WebhookDispatcherConfig = {
  maxRetries: 3,
  timeoutMs: 10_000,
  retryBaseDelayMs: 1_000,
  hmacSecret: "",
};

// ---------------------------------------------------------------------------
// Delivery record (mirrors Firestore webhookDeliveries schema)
// ---------------------------------------------------------------------------

export type DeliveryStatus = "pending" | "success" | "failed";

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventName: string;
  url: string;
  status: DeliveryStatus;
  statusCode?: number;
  attempt: number;
  maxAttempts: number;
  requestBody: string;
  signature: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// HMAC Signing
// ---------------------------------------------------------------------------

async function computeHmac(secret: string, body: string): Promise<string> {
  if (!secret) return "";
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Log delivery to backend (Firestore webhookDeliveries)
// ---------------------------------------------------------------------------

async function logDelivery(delivery: WebhookDelivery): Promise<void> {
  try {
    await apiFetch("/admin/monitoring/webhooks/deliveries", {
      method: "POST",
      body: JSON.stringify(delivery),
    });
  } catch {
    // Best-effort logging – don't block the caller
  }
}

// ---------------------------------------------------------------------------
// Dispatcher class
// ---------------------------------------------------------------------------

export class WebhookDispatcher {
  private config: WebhookDispatcherConfig;

  constructor(config: Partial<WebhookDispatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Dispatch an event payload to the given webhook URL with HMAC signing,
   * automatic retries and delivery logging.
   */
  async dispatch(
    webhookId: string,
    url: string,
    payload: StreamlineEventPayload,
  ): Promise<WebhookDelivery> {
    const body = JSON.stringify(payload);
    const signature = await computeHmac(this.config.hmacSecret, body);
    const maxAttempts = this.config.maxRetries + 1;

    const delivery: WebhookDelivery = {
      id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      webhookId,
      eventId: payload.id,
      eventName: payload.event,
      url,
      status: "pending",
      attempt: 0,
      maxAttempts,
      requestBody: body,
      signature,
      createdAt: new Date().toISOString(),
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      delivery.attempt = attempt;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Streamline-Signature": `sha256=${signature}`,
            "X-Streamline-Event": payload.event,
            "X-Streamline-Delivery": delivery.id,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timer);
        delivery.statusCode = res.status;

        if (res.ok) {
          delivery.status = "success";
          delivery.completedAt = new Date().toISOString();
          break;
        }

        delivery.error = `HTTP ${res.status} ${res.statusText}`;
      } catch (err: unknown) {
        delivery.error = err instanceof Error ? err.message : String(err);
      }

      if (attempt < maxAttempts) {
        const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    if (delivery.status !== "success") {
      delivery.status = "failed";
      delivery.completedAt = new Date().toISOString();
    }

    // Fire-and-forget Firestore delivery log
    logDelivery(delivery);

    return delivery;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: WebhookDispatcher | null = null;

export function getWebhookDispatcher(
  config?: Partial<WebhookDispatcherConfig>,
): WebhookDispatcher {
  if (!_instance) {
    _instance = new WebhookDispatcher(config);
  }
  return _instance;
}

/** Reset the singleton (useful for tests). */
export function resetWebhookDispatcher(): void {
  _instance = null;
}
