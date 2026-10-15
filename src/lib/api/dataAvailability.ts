// Tracks which backend reads are currently failing.
//
// Admin API reads fall back to empty values so pages keep rendering, but an
// empty fallback looks exactly like "nothing is wrong" (0 alerts, no
// diagnostics). Every fallback is recorded here so the UI can say plainly
// that the numbers on screen are not live.

import { useSyncExternalStore } from "react";
import { ApiError } from "./client";

export interface EndpointFailure {
  endpoint: string;
  reason: string;
  failedAt: string;
}

let failures: ReadonlyMap<string, EndpointFailure> = new Map();
let snapshot: EndpointFailure[] = [];
const listeners = new Set<() => void>();

function publish(next: Map<string, EndpointFailure>): void {
  failures = next;
  snapshot = [...next.values()].sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  listeners.forEach((listener) => listener());
}

function describeFailure(error: unknown): string {
  if (error instanceof ApiError) return `HTTP ${error.status}`;
  if (error instanceof Error && error.message) return error.message;
  return "Request failed";
}

export function markEndpointUnavailable(endpoint: string, error: unknown): void {
  const next = new Map(failures);
  next.set(endpoint, { endpoint, reason: describeFailure(error), failedAt: new Date().toISOString() });
  publish(next);
}

export function markEndpointAvailable(endpoint: string): void {
  if (!failures.has(endpoint)) return;
  const next = new Map(failures);
  next.delete(endpoint);
  publish(next);
}

export function getEndpointFailures(): EndpointFailure[] {
  return snapshot;
}

export function resetEndpointFailures(): void {
  publish(new Map());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEndpointFailures(): EndpointFailure[] {
  return useSyncExternalStore(subscribe, getEndpointFailures, getEndpointFailures);
}
