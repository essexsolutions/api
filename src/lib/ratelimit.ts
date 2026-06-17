import type { Env } from "./env";

// Fixed-window per-IP rate limiter backed by Workers KV.
// Cheap and good enough to blunt email-enumeration scraping of the lookup.
export async function rateLimit(
  env: Env,
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<{ ok: boolean; remaining: number }> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / opts.windowSeconds)}`;
  const current = parseInt((await env.RATE_LIMIT.get(bucket)) || "0", 10);
  if (current >= opts.limit) return { ok: false, remaining: 0 };
  await env.RATE_LIMIT.put(bucket, String(current + 1), {
    expirationTtl: opts.windowSeconds + 1,
  });
  return { ok: true, remaining: opts.limit - current - 1 };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
