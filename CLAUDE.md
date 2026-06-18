# CLAUDE.md — essex-api

Guidance for AI agents working in this repo. Read this before making changes.

## What this is

Astro 5 app on **Webflow Cloud** (Cloudflare Workers edge runtime + Cloudflare **D1** SQLite). It powers the returning-lead **email autofill** on the Essex Solutions `/contact` page: a server-side lookup that replaced a Jetboost on-page collection list. See `README.md` for the full story and operator runbook.

The app is **read-mostly**: it mirrors the Webflow Contacts CMS into D1 and serves exact-email lookups. Webflow CMS is the source of truth; D1 is a cache.

## Two repos, one feature

- **`essexsolutions/api`** (this repo) — the backend. Mounted at `/api` on the site.
- **`essexsolutions/essex-tools`** — the front-end script (`essex-email-autofill.js` + `.css`) that runs on `/contact` and calls this app. Served via jsDelivr pinned to a tag (currently `@v2.0.0`). Local path: `../essex-tools`.

If you change the lookup's request/response shape here, update `essex-tools/essex-email-autofill.js` too, then cut a new `essex-tools` tag and bump the jsDelivr `@v…` in `embed/contact-autofill.html` + README.

## Git / pushing

- Remote uses the **`github-essex`** SSH alias (authenticates as the `essexsolutions` org): `git@github-essex:essexsolutions/api.git`. A plain `github.com` key here does **not** have write access.
- Webflow Cloud auto-builds from `main` on push. There is no separate deploy command — **push = deploy**.
- Don't push to `main` without the user's go-ahead.

## Commands

```sh
npm install
npm run build      # astro build (what Webflow Cloud runs)
npm run check      # astro check — run this before committing; keep it at 0 errors
npm run dev        # local dev with bindings (needs .dev.vars)
npm run db:migrate:local
```

Type-checking relies on `@cloudflare/workers-types`. `wrangler types` will fail locally (no resource IDs — Webflow assigns them), so don't depend on it.

## Hard rules / gotchas

- **Edge runtime: `fetch` only.** No `axios`, no Node-only SDKs. The Webflow client in `src/lib/webflow.ts` is plain `fetch`.
- **Migrations are additive-only.** `migrations/*.sql` run automatically on deploy and cannot be edited after deploying. To change schema, add `0001_*.sql` (and mirror it in `src/db/schema.ts`).
- **`wrangler.json` D1 binding must keep `database_id`.** Without it the `DB` binding is undefined at runtime (`...reading 'prepare'`). Webflow assigns the real id on deploy; leave the placeholder if unknown.
- **Don't re-enable Astro's CSRF check.** `astro.config.mjs` sets `security: { checkOrigin: false }` on purpose — it was blocking the admin-sync POST ("Cross-site POST form submissions are forbidden"). The app is cookieless, so this is safe; endpoints have their own auth.
- **`base: "/api"` must match the Webflow Cloud mount path.** Don't change one without the other.
- **KV (`RATE_LIMIT`) is optional.** `ratelimit.ts` no-ops if it isn't bound. Don't make code assume it exists.
- **Secrets** (`WEBFLOW_API_TOKEN`, `ADMIN_SYNC_KEY`, `WEBFLOW_WEBHOOK_SECRET`) live in Webflow Cloud env vars, never in the repo. Local dev reads them from `.dev.vars` (gitignored).

## Data model facts

- Contacts collection `6a1f7c72210b21e4677a6515`; the **email is the CMS `name` field**. `organization` and `region` are *reference* fields resolved to names during sync (`src/lib/webflow.ts`). IDs live in `src/lib/config.ts`.
- D1 `contacts` table is one row per contact, unique-indexed on `email` (lowercased).

## Sync model

- Real-time webhooks are **not usable**: Webflow rejects webhook URLs on `*.webflow.io` ("Invalid hostname"). The `/api/webflow-webhook` handler exists for when a custom domain is added.
- Until then, `.github/workflows/sync.yml` calls `/api/admin/sync` every ~5 min (needs the `ADMIN_SYNC_KEY` GitHub repo secret). Manual run: Actions → "Sync contacts to D1" → Run workflow.

## When verifying changes

- `npm run check` must pass (0 errors) before committing.
- After deploy, sanity-check `/api/health` (reports bindings + contact count).
- `/api/contact-lookup` only works from the live site origin; it returns 403 elsewhere, so test it from the real `/contact` page, not curl/browser.
