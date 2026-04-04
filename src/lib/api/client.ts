const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const STREAMLINE_API_BASE_URL = import.meta.env.VITE_STREAMLINE_API_BASE_URL;
const STREAMLINE_API_TOKEN = import.meta.env.VITE_STREAMLINE_API_TOKEN;
const SUPPORT_DATA_SOURCE = import.meta.env.VITE_SUPPORT_DATA_SOURCE;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildHeaders(
  options?: RequestInit,
  authToken?: string,
  programId?: string,
): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    // Allow the backend to route to the correct program-scoped dataset.
    // All existing endpoints are still functional without this header;
    // its presence is additive and ignored by backends that don't support it.
    ...(programId ? { "X-Program-Id": programId } : {}),
    ...options?.headers,
  };
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }

  if (res.status === 204 || res.headers?.get("content-length") === "0") {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Options accepted by apiFetch in addition to standard RequestInit. */
export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** When provided, sent as X-Program-Id header so the backend can scope data. */
  programId?: string;
}

export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const { programId, ...fetchOpts } = options ?? {};
  const url = `${API_BASE_URL}${path}`;
  return requestJson<T>(url, {
    ...fetchOpts,
    headers: buildHeaders(fetchOpts, undefined, programId),
    credentials: "include",
  });
}

export function isStreamlineSupportEnabled(): boolean {
  return SUPPORT_DATA_SOURCE === "streamline" && Boolean(STREAMLINE_API_BASE_URL);
}

export async function streamlineFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  if (!STREAMLINE_API_BASE_URL) {
    throw new ApiError(500, "StreamLine API base URL is not configured");
  }

  const url = `${STREAMLINE_API_BASE_URL}${path}`;
  return requestJson<T>(url, {
    ...options,
    headers: buildHeaders(options, STREAMLINE_API_TOKEN),
    credentials: "omit",
  });
}
