-- Support Hub monitoring foundation (Stage 1).
-- Timestamps are ISO-8601 UTC strings with milliseconds (Date#toISOString) so
-- they sort lexicographically in the same order as chronologically.

-- Every NXT LVL application that reports into Support Hub. The id is a stable
-- slug ("clientflow") that producers send as application.id.
CREATE TABLE applications (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE application_environments (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  environment    TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  base_url       TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (application_id, environment)
);

-- One credential per application environment, so a leaked key is revoked
-- without touching any other application. Only the SHA-256 of the token is
-- stored; the plaintext is shown once at creation.
CREATE TABLE telemetry_keys (
  id             TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL REFERENCES application_environments(id),
  key_hash       TEXT NOT NULL UNIQUE,
  label          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  last_used_at   TEXT,
  revoked_at     TEXT
);

CREATE INDEX telemetry_keys_environment ON telemetry_keys (environment_id);

-- Normalized telemetry. Only whitelisted operational metadata is stored.
-- event_id is the producer-generated id; (application_id, event_id) makes
-- ingestion idempotent across retries.
CREATE TABLE events (
  id               TEXT PRIMARY KEY,
  application_id   TEXT NOT NULL REFERENCES applications(id),
  environment_id   TEXT NOT NULL REFERENCES application_environments(id),
  event_id         TEXT NOT NULL,
  schema_version   TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('error', 'warning', 'info')),
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'error', 'warning', 'info')),
  occurred_at      TEXT NOT NULL,
  received_at      TEXT NOT NULL,
  app_version      TEXT,
  service          TEXT NOT NULL,
  component        TEXT NOT NULL,
  error_code       TEXT,
  message          TEXT,
  context_json     TEXT,
  -- Set only for events that open or join an incident (type = 'error').
  fingerprint      TEXT,
  telemetry_key_id TEXT REFERENCES telemetry_keys(id),
  UNIQUE (application_id, event_id)
);

CREATE INDEX events_environment_occurred ON events (environment_id, occurred_at DESC);
CREATE INDEX events_application_received ON events (application_id, received_at DESC);

-- An incident is the unit of attention: many events with the same fingerprint
-- collapse into one open incident until it is resolved.
CREATE TABLE incidents (
  id               TEXT PRIMARY KEY,
  application_id   TEXT NOT NULL REFERENCES applications(id),
  environment_id   TEXT NOT NULL REFERENCES application_environments(id),
  fingerprint      TEXT NOT NULL,
  title            TEXT NOT NULL,
  service          TEXT NOT NULL,
  component        TEXT NOT NULL,
  error_code       TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'error', 'warning', 'info')),
  severity_rank    INTEGER NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  first_seen_at    TEXT NOT NULL,
  last_seen_at     TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL,
  last_message     TEXT,
  resolved_at      TEXT,
  resolved_by      TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- At most one open incident per fingerprint; this index is also the conflict
-- target that makes concurrent grouping atomic.
CREATE UNIQUE INDEX incidents_one_open_per_fingerprint
  ON incidents (environment_id, fingerprint) WHERE status = 'open';
CREATE INDEX incidents_status_last_seen ON incidents (status, last_seen_at DESC);
CREATE INDEX incidents_application ON incidents (application_id, last_seen_at DESC);

CREATE TABLE incident_events (
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  event_id    TEXT NOT NULL REFERENCES events(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (incident_id, event_id)
);

CREATE INDEX incident_events_event ON incident_events (event_id);

-- Polled checks. auth_secret_name names a Worker secret (HC_*) whose value is
-- sent as a bearer token; the secret itself never lives in the database.
CREATE TABLE health_checks (
  id                  TEXT PRIMARY KEY,
  environment_id      TEXT NOT NULL REFERENCES application_environments(id),
  name                TEXT NOT NULL,
  kind                TEXT NOT NULL DEFAULT 'http' CHECK (kind IN ('http')),
  url                 TEXT NOT NULL,
  expected_status     INTEGER NOT NULL DEFAULT 200,
  timeout_ms          INTEGER NOT NULL DEFAULT 10000 CHECK (timeout_ms BETWEEN 1000 AND 30000),
  interval_seconds    INTEGER NOT NULL DEFAULT 60 CHECK (interval_seconds >= 60),
  degraded_latency_ms INTEGER,
  auth_secret_name    TEXT,
  enabled             INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  last_run_at         TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  UNIQUE (environment_id, name)
);

CREATE TABLE health_results (
  id              TEXT PRIMARY KEY,
  health_check_id TEXT NOT NULL REFERENCES health_checks(id),
  status          TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
  http_status     INTEGER,
  latency_ms      INTEGER,
  error_type      TEXT CHECK (error_type IN ('timeout', 'network', 'http_status', 'config')),
  error_message   TEXT,
  checked_at      TEXT NOT NULL
);

CREATE INDEX health_results_check_time ON health_results (health_check_id, checked_at DESC);
CREATE INDEX health_results_checked_at ON health_results (checked_at);
