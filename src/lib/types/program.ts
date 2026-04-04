// ---------------------------------------------------------------------------
// Program registry types — every connected program is described by these
// interfaces so tabs and pages can be config-driven instead of hardcoded.
// ---------------------------------------------------------------------------

export type ProgramEnvironment = "production" | "staging" | "dev";
export type AuthMethod = "bearer" | "api-key" | "none";

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

/** Endpoint paths for each enabled module (relative to apiBaseUrl). */
export interface ProgramEndpoints {
  monitoring?: {
    status?: string;
    rooms?: string;
    roomDetail?: string;
    roomChat?: string;
    horizonStatus?: string;
  };
  tickets?: {
    list?: string;
    create?: string;
    detail?: string;
  };
  logs?: {
    list?: string;
  };
  metrics?: {
    overview?: string;
  };
}

/** Auth configuration for a program's API. */
export interface ProgramAuth {
  method: AuthMethod;
  /** env-var name that holds the token (never the raw value). */
  tokenEnvVar?: string;
}

/** Full descriptor for one connected program. */
export interface ProgramConfig {
  id: string;
  name: string;
  slug: string;
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
