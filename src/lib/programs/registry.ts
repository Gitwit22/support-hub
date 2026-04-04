// ---------------------------------------------------------------------------
// Central program registry.
// StreamLine is seeded as the first registered program — it is the reference
// integration and backward-compatibility baseline.
// ---------------------------------------------------------------------------

import type { ProgramConfig } from "@/lib/types/program";

// ---------------------------------------------------------------------------
// StreamLine seed — values mirror the env-var driven config in streamlineApi.ts
// so existing monitoring and ticket wiring continues to work when this program
// is selected.
// ---------------------------------------------------------------------------

const STREAMLINE_SEED: ProgramConfig = {
  id: "streamline-prod",
  name: "StreamLine",
  slug: "streamline",
  environment: "production",
  // Falls back to empty string when env var is not set; the existing
  // streamlineApi.ts code already handles that gracefully.
  apiBaseUrl: import.meta.env.VITE_STREAMLINE_API_BASE_URL ?? "",
  healthEndpoint: "/api/horizon/bot/support/status",
  auth: {
    method: "bearer",
    tokenEnvVar: "VITE_STREAMLINE_API_TOKEN",
  },
  capabilities: {
    monitoring: true,
    tickets: true,
    logs: false,
    metrics: false,
    alerts: true,
    chat: false,
    diagnostics: true,
  },
  endpoints: {
    monitoring: {
      status: "/api/horizon/bot/support/status",
      rooms: "/api/horizon/bot/support/rooms",
      roomDetail: "/api/horizon/bot/support/rooms/:roomId",
      roomChat: "/api/horizon/bot/support/rooms/:roomId/chat",
      horizonStatus: "/api/admin/monitoring",
    },
    tickets: {
      list: "/api/edu/tickets",
      create: "/api/edu/tickets",
      detail: "/api/edu/tickets/:id",
    },
  },
  description: "StreamLine platform — reference integration for Support Hub",
  registeredAt: "2024-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// In-memory registry.  User-added programs (from the intake wizard) are stored
// in localStorage and merged at runtime; the StreamLine seed is always first.
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

/** Returns all registered programs.  StreamLine is always first. */
export function listPrograms(): ProgramConfig[] {
  const user = loadUserPrograms().filter((p) => p.id !== STREAMLINE_SEED.id);
  return [STREAMLINE_SEED, ...user];
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
 */
export function registerProgram(config: ProgramConfig): void {
  if (config.id === STREAMLINE_SEED.id) {
    // StreamLine seed is immutable from the UI.
    return;
  }
  const existing = loadUserPrograms().filter((p) => p.id !== config.id);
  saveUserPrograms([...existing, config]);
}

/**
 * Removes a user-added program from the registry.
 * The StreamLine seed cannot be removed.
 */
export function removeProgram(id: string): void {
  if (id === STREAMLINE_SEED.id) return;
  const updated = loadUserPrograms().filter((p) => p.id !== id);
  saveUserPrograms(updated);
}
