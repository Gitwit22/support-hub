// Derives an environment's status from its latest check results and open
// incidents. The rule that matters most: the absence of data is "unknown",
// never "healthy" — a stalled poller must not look like a calm system.

export type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";
export type CheckState = "up" | "degraded" | "down" | "stale" | "pending";

const MIN_STALE_AFTER_MS = 5 * 60 * 1000;

export interface CheckSnapshot {
  id: string;
  name: string;
  intervalSeconds: number;
  lastStatus: "up" | "degraded" | "down" | null;
  lastCheckedAt: string | null;
}

export interface EnvironmentStatus {
  status: ServiceStatus;
  reasons: string[];
}

export function checkState(check: CheckSnapshot, now: number): CheckState {
  if (!check.lastStatus || !check.lastCheckedAt) return "pending";
  const staleAfter = Math.max(check.intervalSeconds * 3 * 1000, MIN_STALE_AFTER_MS);
  if (now - Date.parse(check.lastCheckedAt) > staleAfter) return "stale";
  return check.lastStatus;
}

export function deriveEnvironmentStatus(
  checks: CheckSnapshot[],
  openCriticalIncidents: number,
  now = Date.now(),
): EnvironmentStatus {
  const reasons: string[] = [];
  if (!checks.length) {
    reasons.push("No enabled health checks");
    return { status: "unknown", reasons };
  }

  const states = checks.map((check) => ({ check, state: checkState(check, now) }));
  for (const { check, state } of states) {
    if (state === "down") reasons.push(`${check.name} is down`);
    else if (state === "degraded") reasons.push(`${check.name} is degraded`);
    else if (state === "stale") reasons.push(`${check.name} has no recent result`);
    else if (state === "pending") reasons.push(`${check.name} has not run yet`);
  }
  if (openCriticalIncidents > 0) {
    reasons.push(`${openCriticalIncidents} open critical incident(s)`);
  }

  if (states.some((s) => s.state === "down")) return { status: "down", reasons };
  if (states.some((s) => s.state === "degraded") || openCriticalIncidents > 0) return { status: "degraded", reasons };
  if (states.some((s) => s.state === "stale" || s.state === "pending")) return { status: "unknown", reasons };
  return { status: "healthy", reasons };
}
