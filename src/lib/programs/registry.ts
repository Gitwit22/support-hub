// ---------------------------------------------------------------------------
// Central program registry.
// StreamLine is seeded as the first registered program — it is the reference
// integration and backward-compatibility baseline.
// Deprecated Community Hub entries are pruned from user storage.
// ---------------------------------------------------------------------------

import type { ProgramConfig, ProgramEndpoints } from "@/lib/types/program";

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
// Built-in seeds — immutable from the UI.
// ---------------------------------------------------------------------------

const BUILT_IN_IDS = new Set([STREAMLINE_SEED.id]);

function isDeprecatedCommunityHubProgram(program: ProgramConfig): boolean {
  return (
    program.id.startsWith("community-hub") ||
    program.slug === "community-hub" ||
    program.presetType === "community-hub"
  );
}

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
    if (!Array.isArray(parsed)) return [];

    const programs = parsed as ProgramConfig[];
    const cleaned = programs.filter(
      (program) => !isDeprecatedCommunityHubProgram(program)
    );

    // Persist cleanup so removed Community Hub entries do not come back.
    if (cleaned.length !== programs.length) {
      saveUserPrograms(cleaned);
    }

    return cleaned;
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

// ---------------------------------------------------------------------------
// Program overrides — stores mutable fields (endpoints, usageKeyMapping) for
// built-in programs so they remain editable without breaking immutability of
// the seed object itself.
// ---------------------------------------------------------------------------

const OVERRIDES_KEY = "supportHubProgramOverrides";

interface ProgramOverride {
  endpoints?: ProgramEndpoints;
  usageKeyMapping?: Record<string, string>;
}

function loadOverrides(): Record<string, ProgramOverride> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, ProgramOverride>;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, ProgramOverride>): void {
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Storage unavailable — ignore.
  }
}

function applyOverrides(program: ProgramConfig): ProgramConfig {
  const overrides = loadOverrides();
  const override = overrides[program.id];
  if (!override) return program;
  return {
    ...program,
    ...(override.endpoints !== undefined && {
      endpoints: { ...program.endpoints, ...override.endpoints },
    }),
    ...(override.usageKeyMapping !== undefined && {
      usageKeyMapping: override.usageKeyMapping,
    }),
  };
}

/** Returns all registered programs.  Built-in seeds are always first. */
export function listPrograms(): ProgramConfig[] {
  const user = loadUserPrograms().filter((p) => !BUILT_IN_IDS.has(p.id));
  return [applyOverrides(STREAMLINE_SEED), ...user];
}

/** Looks up a program by ID. */
export function getProgramById(id: string): ProgramConfig | undefined {
  return listPrograms().find((p) => p.id === id);
}

/** Returns the default program (StreamLine). */
export function getDefaultProgram(): ProgramConfig {
  return applyOverrides(STREAMLINE_SEED);
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

/**
 * Updates the endpoint paths for any program.
 * For built-in programs, overrides are stored separately so the seed is
 * preserved.  For user programs, the full config is re-saved.
 */
export function updateProgramEndpoints(
  id: string,
  endpoints: ProgramEndpoints
): void {
  if (BUILT_IN_IDS.has(id)) {
    const overrides = loadOverrides();
    overrides[id] = { ...(overrides[id] ?? {}), endpoints };
    saveOverrides(overrides);
    return;
  }
  const programs = loadUserPrograms();
  const updated = programs.map((p) =>
    p.id === id ? { ...p, endpoints: { ...p.endpoints, ...endpoints } } : p
  );
  saveUserPrograms(updated);
}

/**
 * Updates the usage key mapping for any program.
 * For built-in programs, the mapping is stored in the overrides store.
 */
export function updateProgramUsageMapping(
  id: string,
  usageKeyMapping: Record<string, string>
): void {
  if (BUILT_IN_IDS.has(id)) {
    const overrides = loadOverrides();
    overrides[id] = { ...(overrides[id] ?? {}), usageKeyMapping };
    saveOverrides(overrides);
    return;
  }
  const programs = loadUserPrograms();
  const updated = programs.map((p) =>
    p.id === id ? { ...p, usageKeyMapping } : p
  );
  saveUserPrograms(updated);
}

/**
 * Returns the default endpoint paths for a program based on its seed /
 * original registration.  For built-in programs this is the seed's endpoints.
 */
export function getDefaultEndpoints(id: string): ProgramEndpoints | undefined {
  if (id === STREAMLINE_SEED.id) return STREAMLINE_SEED.endpoints;
  const prog = loadUserPrograms().find((p) => p.id === id);
  return prog?.endpoints;
}

