// Telemetry ingestion contract, schema version 1.x.
//
// Versioning rules:
//   - schemaVersion is required and has the form "<major>.<minor>".
//   - An unsupported major version is rejected; it is never reinterpreted.
//   - Minor versions are additive. Fields this server does not know are
//     dropped (never stored) and listed back to the producer as ignoredFields.

import { z } from "zod";
import { HttpError } from "../http";

export const SUPPORTED_SCHEMA_MAJORS = [1] as const;

export const SEVERITY_RANK = { info: 0, warning: 1, error: 2, critical: 3 } as const;
export type Severity = keyof typeof SEVERITY_RANK;

export const APPLICATION_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
export const ENVIRONMENTS = ["production", "staging", "development"] as const;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
// Bounded clock skew: a producer clock far ahead would otherwise pin
// incidents' last_seen_at in the future.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const identifier = z
  .string()
  .regex(IDENTIFIER_PATTERN, "must be 1-64 characters of letters, digits, '.', '_' or '-'")
  .transform((value) => value.toLowerCase());

const eventSchemaV1 = z
  .object({
    schemaVersion: z.string(),
    eventId: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }),
    application: z.object({
      id: z.string().regex(APPLICATION_ID_PATTERN),
      environment: z.enum(ENVIRONMENTS),
      version: z.string().min(1).max(64).optional(),
    }),
    type: z.enum(["error", "warning", "info"]),
    severity: z.enum(["critical", "error", "warning", "info"]),
    source: z.object({
      service: identifier,
      component: identifier,
    }),
    error: z
      .object({
        code: z.string().regex(ERROR_CODE_PATTERN, "must be UPPER_SNAKE_CASE, 2-64 characters"),
        message: z.string().max(500).optional(),
      })
      .optional(),
    context: z
      .object({
        requestId: z.string().min(1).max(128).optional(),
        route: z.string().min(1).max(256).optional(),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
        statusCode: z.number().int().min(100).max(599).optional(),
        durationMs: z.number().int().min(0).max(3_600_000).optional(),
        operation: identifier.optional(),
      })
      .optional(),
  })
  .superRefine((event, ctx) => {
    if (event.type === "error" && !event.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["error"], message: "is required when type is 'error'" });
    }
    if (Date.parse(event.timestamp) - Date.now() > MAX_FUTURE_SKEW_MS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timestamp"], message: "is more than 5 minutes in the future" });
    }
  });

export type TelemetryEventV1 = z.infer<typeof eventSchemaV1>;

export interface ParsedEvent {
  event: TelemetryEventV1;
  ignoredFields: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lists keys present in the input but dropped by the schema (dotted paths). */
function collectIgnoredFields(input: unknown, output: unknown, prefix = ""): string[] {
  if (!isPlainObject(input) || !isPlainObject(output)) return [];
  const ignored: string[] = [];
  for (const key of Object.keys(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in output)) ignored.push(path);
    else ignored.push(...collectIgnoredFields(input[key], output[key], path));
  }
  return ignored;
}

export function parseSchemaVersion(value: unknown): { major: number; minor: number } {
  if (typeof value !== "string" || !/^\d+\.\d+$/.test(value)) {
    throw new HttpError(400, "INVALID_SCHEMA_VERSION", 'schemaVersion is required and must look like "1.0"');
  }
  const [major, minor] = value.split(".").map(Number);
  return { major, minor };
}

export function parseTelemetryEvent(body: unknown): ParsedEvent {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "INVALID_EVENT", "Body must be a JSON object");
  }
  const { major } = parseSchemaVersion(body.schemaVersion);
  if (!(SUPPORTED_SCHEMA_MAJORS as readonly number[]).includes(major)) {
    throw new HttpError(400, "UNSUPPORTED_SCHEMA_VERSION", `schemaVersion major ${major} is not supported`, {
      supportedMajorVersions: [...SUPPORTED_SCHEMA_MAJORS],
    });
  }
  const result = eventSchemaV1.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "INVALID_EVENT", "Event does not match the telemetry contract", {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  return { event: result.data, ignoredFields: collectIgnoredFields(body, result.data) };
}
