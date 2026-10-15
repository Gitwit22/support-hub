export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function errorResponse(error: HttpError): Response {
  return json(
    { error: { code: error.code, message: error.message, ...(error.details ?? {}) } },
    error.status,
  );
}

export const MAX_JSON_BODY_BYTES = 16 * 1024;

/** Reads a JSON body, enforcing content type and a size cap before parsing. */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Body exceeds ${maxBytes} bytes`);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Body exceeds ${maxBytes} bytes`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Body is not valid JSON");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Parses an integer query parameter, clamped to [min, max]. */
export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, "INVALID_QUERY", `Expected an integer, got "${value}"`);
  }
  return Math.min(max, Math.max(min, parsed));
}

export function isoParam(value: string | null, name: string): string | undefined {
  if (value === null || value === "") return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new HttpError(400, "INVALID_QUERY", `${name} must be an ISO timestamp`);
  return new Date(time).toISOString();
}
