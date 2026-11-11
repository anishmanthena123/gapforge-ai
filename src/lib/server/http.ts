import "server-only";
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<unknown> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const timeout = AbortSignal.timeout(15000);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal, cache: "no-store" });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt === attempts - 1)
        throw new ProviderError(
          new URL(url).hostname,
          0,
          "Provider connection failed or timed out.",
        );
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      continue;
    }
    if (response.ok) return response.json();
    console.warn(
      JSON.stringify({
        event: "provider_http_error",
        host: new URL(url).hostname,
        status: response.status,
        attempt: attempt + 1,
      }),
    );
    if (
      [429, 500, 502, 503, 504].includes(response.status) &&
      attempt < attempts - 1
    ) {
      const raw = response.headers.get("retry-after");
      const seconds = raw ? Number(raw) : NaN;
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : raw
          ? Date.parse(raw) - Date.now()
          : 400 * 2 ** attempt;
      if (delay > 8000)
        throw new ProviderError(
          new URL(url).hostname,
          response.status,
          "Provider rate limit reached. Retry later.",
        );
      await new Promise((r) => setTimeout(r, Math.max(100, delay)));
      continue;
    }
    throw new ProviderError(
      new URL(url).hostname,
      response.status,
      response.status === 401 || response.status === 403
        ? "Provider authentication or network access is required."
        : response.status === 429
          ? "Provider rate limit reached. Retry later."
          : `Provider returned HTTP ${response.status}.`,
    );
  }
  throw new Error("Provider did not respond.");
}
const buckets = new Map<string, { count: number; reset: number }>();
export function takeRateLimit(
  key: string,
  limit = 12,
  now = Date.now(),
): boolean {
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    if (buckets.size > 10000) return false;
  }
  const old = buckets.get(key);
  if (!old || old.reset <= now) {
    buckets.set(key, { count: 1, reset: now + 60000 });
    return true;
  }
  if (old.count >= limit) return false;
  old.count++;
  return true;
}
export function guardRequest(request: Request, limit = 12) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Error("Cross-origin requests are not allowed.");
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!takeRateLimit(key, limit))
    throw new ProviderError(
      "GapForge",
      429,
      "Too many requests. Please wait a minute.",
    );
}
export async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") || 0) > 2000000)
    throw new Error("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 2000000) {
      await reader.cancel();
      throw new Error("Request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function errorResponse(error: unknown) {
  const status = error instanceof ProviderError ? error.status || 502 : 400;
  return Response.json(
    { error: error instanceof Error ? error.message : "Request failed." },
    {
      status: status >= 400 ? status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
