// ---------------------------------------------------------------------------
// Program registry types — every connected program is described by these
// interfaces so tabs and pages can be config-driven instead of hardcoded.
// ---------------------------------------------------------------------------

export type ProgramEnvironment = "production" | "staging" | "dev";
export type AuthMethod = "bearer" | "api-key" | "none";

/**
 * Optional preset used during onboarding.  Affects only wizard defaults;
 * the stored config is fully generic after the wizard completes.
 */
export type ProgramPreset = "streamline" | "horizon" | "community-hub" | "custom";

/** Which functional modules a program has enabled. */
export interface ProgramCapabilities {
  monitoring: boolean;
  tickets: boolean;
  logs: boolean;
  metrics: boolean;
  alerts: boolean;
  chat: boolean;
  diagnostics: boolean;
}

/**
 * Generic endpoint category paths — all values are relative to apiBaseUrl.
 * These are intentionally platform-agnostic; StreamLine-specific paths are
 * stored here but look no different to the framework than any other program.
 */
export interface ProgramEndpoints {
  /** Simple ping / connectivity check. */
  health?: string;
  /** Detailed service status. */
  status?: string;
  /** Event ingest / telemetry stream. */
  eventsIngest?: string;
  /** Alerts feed. */
  alerts?: string;
  /** Usage / metering overview. */
  usage?: string;
  /** Webhook management. */
  webhooks?: string;
  /** Diagnostics self-check. */
  diagnostics?: string;
  /** List of primary resources (rooms, docs, tickets, jobs…). */
  resourceList?: string;
  /** Single resource detail — use :id as placeholder. */
  resourceDetail?: string;
  /** Activity stream for a resource — use :id as placeholder. */
  resourceActivity?: string;
  /** Any additional custom paths beyond the standard categories. */
  [key: string]: string | undefined;
}

/** Auth configuration for a program's API. */
export interface ProgramAuth {
  method: AuthMethod;
  /** env-var name that holds the token (never the raw value). */
  tokenEnvVar?: string;
  /** Human-readable label for the token field shown in the wizard. */
  tokenLabel?: string;
}

/** Full descriptor for one connected program. */
export interface ProgramConfig {
  id: string;
  name: string;
  slug: string;
  /** Internal system/platform name (e.g. "StreamLine", "Horizon"). */
  systemName?: string;
  /**
   * Preset used during onboarding.  Stored so the wizard can show correct
   * defaults when editing, but has no runtime behavioral effect.
   */
  presetType?: ProgramPreset;
  /** Singular label for the primary resource type (e.g. "room", "ticket"). */
  resourceLabel?: string;
  environment: ProgramEnvironment;
  apiBaseUrl: string;
  healthEndpoint: string;
  auth: ProgramAuth;
  capabilities: ProgramCapabilities;
  endpoints: ProgramEndpoints;
  /** Human-readable description shown in the switcher. */
  description?: string;
  /** ISO string — when the program was added to the registry. */
  registeredAt: string;
}
