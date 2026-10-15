export interface Env {
  DB: D1Database;
  /** Static assets binding serving the Support Hub UI (dist/). */
  ASSETS: Fetcher;
  /** e.g. https://nxtlvl.cloudflareaccess.com — issuer of Cloudflare Access JWTs. */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag of the Access application protecting the dashboard. */
  ACCESS_AUD?: string;
  /** "true" skips Access verification, honoured only for requests to localhost. */
  AUTH_DEV_BYPASS?: string;
  /** Health-check bearer secrets, referenced by health_checks.auth_secret_name. */
  [secretName: `HC_${string}`]: string | undefined;
}
