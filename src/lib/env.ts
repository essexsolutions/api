/// <reference types="@cloudflare/workers-types" />

// Bindings + secrets available at runtime. In Astro endpoints these come from
// `locals.runtime.env` (Cloudflare Workers runtime via @astrojs/cloudflare).
export interface Env {
  // Storage bindings (declared in wrangler.json; IDs assigned by Webflow Cloud)
  DB: D1Database;
  RATE_LIMIT?: KVNamespace; // optional: add a KV namespace later to enable rate limiting

  // Secrets (set in Webflow Cloud → Environment Variables, marked "secret")
  WEBFLOW_API_TOKEN?: string; // Data API token; used by admin full-sync only
  WEBFLOW_WEBHOOK_SECRET?: string; // shared secret guarding the webhook URL
  ADMIN_SYNC_KEY?: string; // shared secret guarding the manual full-sync

  // Optional overrides
  ALLOWED_ORIGIN?: string; // defaults to the Webflow published domain
}

export function getEnv(locals: App.Locals): Env {
  // @astrojs/cloudflare exposes bindings here.
  const env = (locals as any)?.runtime?.env as Env | undefined;
  if (!env) {
    throw new Error(
      "Cloudflare runtime env not available. Are you running under the Cloudflare adapter / wrangler?",
    );
  }
  return env;
}
