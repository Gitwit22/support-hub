// Server-side redaction. Producers are told not to send personal data or
// secrets; these rules are the backstop for when one does by mistake.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const QUERY_VALUE = /([?&][^=\s&#]+=)[^\s&#]+/g;
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/g;

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_SEGMENT = /^[A-Za-z0-9_.~-]{20,}$/;

export function redactMessage(message: string): string {
  return message
    .replace(JWT, "[redacted-token]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(EMAIL, "[redacted-email]")
    .replace(QUERY_VALUE, "$1[redacted]")
    .replace(LONG_TOKEN, "[redacted-token]");
}

/**
 * Routes should be templates ("/s/:token"). When a concrete path arrives, the
 * query string is dropped and id/token-like segments are replaced, because
 * several ClientFlow public routes carry access tokens in the path.
 */
export function redactRoute(route: string): string {
  const path = route.split(/[?#]/, 1)[0] || "/";
  return path
    .split("/")
    .map((segment) => {
      if (UUID_SEGMENT.test(segment)) return ":id";
      if (TOKEN_SEGMENT.test(segment)) return ":redacted";
      return segment;
    })
    .join("/");
}
