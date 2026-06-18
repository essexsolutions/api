// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// IMPORTANT: `base` must match the mount path you choose in Webflow Cloud.
// If you mount this app at `/api`, every route below is served under
// https://essexsolutions.webflow.io/api/...
// e.g. src/pages/contact-lookup.ts  ->  /api/contact-lookup
export default defineConfig({
  output: "server",
  base: "/api",
  // Disable Astro's form-CSRF origin check. It blocks POSTs that look like
  // cross-site form submissions ("Cross-site POST form submissions are
  // forbidden") — which broke the admin-sync curl and would block the Webflow
  // webhook. Safe here: every endpoint has its own auth (same-origin gate,
  // admin key, webhook secret) and the app uses no cookies/sessions.
  security: { checkOrigin: false },
  adapter: cloudflare({
    platformProxy: { enabled: true }, // gives `locals.runtime.env` bindings in `astro dev`
  }),
});
