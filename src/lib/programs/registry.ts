// ---------------------------------------------------------------------------
// Central program registry.
// StreamLine is seeded as the first registered program — it is the reference
// integration and backward-compatibility baseline.
// Community Hub is seeded second as a lightweight monitoring/telemetry profile.
// ---------------------------------------------------------------------------

import type { ProgramConfig } from "@/lib/types/program";

// ---------------------------------------------------------------------------
// StreamLine seed — endpoint paths mirror the env-var driven config in
// streamlineApi.ts so existing monitoring and ticket wiring continues to
// work when this program is selected.
// ---------------------------------------------------------------------------

const STREAMLINE_SEED: ProgramConfig = {
  id: "streamline-prod",
  name: "StreamLine",
  slug: "streamline",
  systemName: "StreamLine",
  presetType: "streamline",
  resourceLabel: "room",
  environment: "production",
  // Falls back to empty string when env var is not set; streamlineApi.ts
  // handles that case gracefully via its own env-var read.
  apiBaseUrl: import.meta.env.VITE_STREAMLINE_API_BASE_URL ?? "",
  healthEndpoint: "/api/horizon/bot/support/status",
  auth: {
    method: "bearer",
    tokenEnvVar: "VITE_STREAMLINE_API_TOKEN",
    tokenLabel: "StreamLine API Token",
  },
  capabilities: {
    monitoring: true,
    tickets: true,
    logs: false,
    metrics: true,
    alerts: true,
    chat: false,
    diagnostics: true,
  },
  endpoints: {
    health: "/api/horizon/bot/support/status",
    status: "/api/horizon/bot/support/status",
    resourceList: "/api/horizon/bot/support/rooms",
    resourceDetail: "/api/horizon/bot/support/rooms/:id",
    resourceActivity: "/api/horizon/bot/support/rooms/:id/chat",
    alerts: "/api/admin/monitoring",
    usage: "/api/admin/usage",
    webhooks: "/api/admin/webhooks",
    diagnostics: "/api/admin/diagnostics",
  },
  description: "StreamLine platform — reference integration for Support Hub",
  registeredAt: "2024-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Community Hub seed — lightweight monitoring / telemetry profile.
// No room/Horizon-specific assumptions.
// ---------------------------------------------------------------------------

const COMMUNITY_HUB_SEED: ProgramConfig = {
  id: "community-hub-prod",
  name: "Community Hub",
  slug: "community-hub",
  systemName: "Community Hub",
  presetType: "community-hub",
  resourceLabel: "community",
  environment: "production",
  apiBaseUrl: "",
  healthEndpoint: "/health",
  auth: {
    method: "bearer",
    tokenLabel: "API Token",
  },
  capabilities: {
    monitoring: true,
    tickets: false,
    logs: false,
    metrics: true,
    alerts: false,
    chat: false,
    diagnostics: true,
  },
  endpoints: {
    health: "/health",
    status: "/status",
    eventsIngest: "/events",
    usage: "/usage",
    diagnostics: "/diagnostics",
  },
  description: "Community Hub — health, telemetry, and usage visibility",
  registeredAt: "2024-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Built-in seeds — immutable from the UI.
// ---------------------------------------------------------------------------

const BUILT_IN_IDS = new Set([STREAMLINE_SEED.id, COMMUNITY_HUB_SEED.id]);

/** Returns true when the ID belongs to a built-in immutable seed. */
export function isBuiltInProgram(id: string): boolean {
  return BUILT_IN_IDS.has(id);
}

// ---------------------------------------------------------------------------
// In-memory registry.  User-added programs (from the intake wizard) are
// stored in localStorage and merged at runtime; built-in seeds are always
// first.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "supportHubProgramRegistry";

function loadUserPrograms(): ProgramConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgramConfig[]) : [];
  } catch {
    return [];
  }
}

function saveUserPrograms(programs: ProgramConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
  } catch {
    // Storage unavailable — ignore.
  }
}

/** Returns all registered programs.  Built-in seeds are always first. */
export function listPrograms(): ProgramConfig[] {
  const user = loadUserPrograms().filter((p) => !BUILT_IN_IDS.has(p.id));
  return [STREAMLINE_SEED, COMMUNITY_HUB_SEED, ...user];
}

/** Looks up a program by ID. */
export function getProgramById(id: string): ProgramConfig | undefined {
  return listPrograms().find((p) => p.id === id);
}

/** Returns the default program (StreamLine). */
export function getDefaultProgram(): ProgramConfig {
  return STREAMLINE_SEED;
}

/**
 * Registers a new program in the user-editable portion of the registry.
 * If a program with the same ID already exists it is replaced.
 * Built-in seeds cannot be overwritten.
 */
export function registerProgram(config: ProgramConfig): void {
  if (BUILT_IN_IDS.has(config.id)) {
    // Built-in seeds are immutable from the UI.
    return;
  }
  const existing = loadUserPrograms().filter((p) => p.id !== config.id);
  saveUserPrograms([...existing, config]);
}

/**
 * Removes a user-added program from the registry.
 * Built-in seeds cannot be removed.
 */
export function removeProgram(id: string): void {
  if (BUILT_IN_IDS.has(id)) return;
  const updated = loadUserPrograms().filter((p) => p.id !== id);
  saveUserPrograms(updated);
}

