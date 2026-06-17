import type { Env } from "./env";

const DEFAULT_ALLOWED_ORIGIN = "https://essexsolutions.webflow.io";

export function allowedOrigin(env: Env): string {
  return env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
}

// The app is same-origin with the form in production, so CORS is mostly a
// formality — but we still echo a locked-down origin so the endpoint can't be
// called from arbitrary third-party sites.
export function corsHeaders(env: Env, origin: string | null): HeadersInit {
  const allow = allowedOrigin(env);
  const ok = origin === allow;
  return {
    "Access-Control-Allow-Origin": ok ? allow : allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function json(
  data: unknown,
  init: ResponseInit = {},
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// Reject requests that aren't coming from our own published site. We check both
// Origin (sent on fetch) and Referer as a fallback. Server-to-server callers
// (the webhook, admin sync) authenticate with a shared secret instead.
export function isSameSite(env: Env, request: Request): boolean {
  const allow = allowedOrigin(env);
  const origin = request.headers.get("Origin");
  if (origin) return origin === allow;
  const referer = request.headers.get("Referer");
  if (referer) return referer.startsWith(allow);
  return false;
}

// Constant-time string compare to avoid timing leaks on secret comparison.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
