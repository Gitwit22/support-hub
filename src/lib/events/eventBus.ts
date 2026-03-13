// ---------------------------------------------------------------------------
// Streamline event bus – singleton that acts as the central hub for all
// Streamline events and forwards them to the webhook dispatcher.
// ---------------------------------------------------------------------------

import type { StreamlineEventName, StreamlineEventPayload } from "./eventTypes";
import { getWebhookDispatcher } from "./webhookDispatcher";

// ---------------------------------------------------------------------------
// Minimal EventEmitter (browser-compatible, mirrors Node EventEmitter API)
// ---------------------------------------------------------------------------

type Listener = (payload: StreamlineEventPayload) => void;

export class StreamlineEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private webhookSubscriptions: Array<{
    webhookId: string;
    url: string;
    events: StreamlineEventName[];
  }> = [];

  // -----------------------------------------------------------------------
  // Subscribe / Unsubscribe
  // -----------------------------------------------------------------------

  on(event: StreamlineEventName, listener: Listener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: StreamlineEventName, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  once(event: StreamlineEventName, listener: Listener): this {
    const wrapper: Listener = (payload) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  // -----------------------------------------------------------------------
  // Emit
  // -----------------------------------------------------------------------

  emit(payload: StreamlineEventPayload): void {
    // Notify in-process listeners
    const listeners = this.listeners.get(payload.event);
    if (listeners) {
      for (const fn of listeners) {
        try {
          fn(payload);
        } catch {
          // Swallow listener errors to avoid blocking other listeners
        }
      }
    }

    // Forward to webhook dispatcher for all matching subscriptions
    this.forwardToWebhooks(payload);
  }

  // -----------------------------------------------------------------------
  // Webhook subscription management
  // -----------------------------------------------------------------------

  registerWebhook(
    webhookId: string,
    url: string,
    events: StreamlineEventName[],
  ): void {
    this.webhookSubscriptions.push({ webhookId, url, events });
  }

  unregisterWebhook(webhookId: string): void {
    this.webhookSubscriptions = this.webhookSubscriptions.filter(
      (s) => s.webhookId !== webhookId,
    );
  }

  getWebhookSubscriptions() {
    return [...this.webhookSubscriptions];
  }

  // -----------------------------------------------------------------------
  // Internal – dispatch to subscribed webhooks (non-blocking)
  // -----------------------------------------------------------------------

  private forwardToWebhooks(payload: StreamlineEventPayload): void {
    const dispatcher = getWebhookDispatcher();
    for (const sub of this.webhookSubscriptions) {
      if (sub.events.includes(payload.event as StreamlineEventName)) {
        // Fire-and-forget: don't block the emitter
        dispatcher.dispatch(sub.webhookId, sub.url, payload).catch(() => {
          /* delivery errors are already logged by the dispatcher */
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  listenerCount(event: StreamlineEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(event?: StreamlineEventName): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _bus: StreamlineEventBus | null = null;

export function getEventBus(): StreamlineEventBus {
  if (!_bus) {
    _bus = new StreamlineEventBus();
  }
  return _bus;
}

/** Reset the singleton (useful for tests). */
export function resetEventBus(): void {
  _bus = null;
}
