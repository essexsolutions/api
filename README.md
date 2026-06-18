# essex-api

Edge API for the **Essex Solutions** website, running on **Webflow Cloud** (Astro 5 on the Cloudflare Workers runtime, with a Cloudflare **D1** SQLite database).

Its one job: power the **returning-lead autofill** on the `/contact` page. When a visitor types their email, the form looks them up and pre-fills their details for them — **without** shipping your whole contact list to the browser.

---

## Why this exists (the problem it replaced)

The `/contact` form used to autofill from a **Jetboost on-page Collection List**. That had three serious problems:

1. **Privacy leak** — every contact's name, email, phone, org, etc. was rendered into the page's HTML. "Hidden" was just CSS; anyone could open DevTools and read all of it.
2. **100-item cap** — Webflow Collection Lists only render 100 items, so the lookup silently broke past 100 contacts.
3. **Broke the form** — the email field doubled as Jetboost's search box, and Jetboost disabled the form's **Submit button** while "searching", so the form couldn't be submitted.

This app fixes all three by doing the lookup **on the server**: the browser only ever receives the single contact that matches the email typed.

---

## How it works (the whole flow)

```
                    Webflow CMS "Contacts"  (source of truth — you edit here)
                              │
                              │  GitHub Action runs POST /api/admin/sync every ~5 min
                              │  (reads all contacts, resolves Organization/Region
                              │   reference fields to plain names)
                              ▼
                    D1 table `contacts`  (read cache, indexed by email)
                              ▲
                              │  GET /api/contact-lookup?email=…   (exact email only)
                              │
   Visitor types email  ───►  essex-email-autofill.js on /contact  ───►  fills the form
   (the front-end script lives in the essexsolutions/essex-tools repo,
    loaded via jsDelivr; it calls this app's lookup endpoint)
```

Key design points:

- **Webflow CMS stays the source of truth.** You add/edit contacts in Webflow as normal. D1 is just a fast, queryable copy.
- **The email is the CMS `name` field** (e.g. `jane@acme.com`). `organization` and `region` are CMS *reference* fields; the sync resolves them to plain text names so a lookup is one indexed query.
- **Sync is scheduled, not real-time.** Webflow refuses to send webhooks to `*.webflow.io` addresses (see [Sync](#keeping-d1-in-sync)), so a GitHub Action re-runs the full sync every ~5 minutes instead. The webhook handler exists and is ready for when the site gets a custom domain.

---

## Endpoints

All are served under the `/api` mount path (i.e. `https://essexsolutions.webflow.io/api/...`).

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | none | liveness + shows which bindings/secrets the app can see |
| `/api/contact-lookup?email=` | GET | same-origin only + optional IP rate limit | the front-end calls this; returns `{ match, contact }` for an exact email match |
| `/api/admin/sync` | POST | `x-admin-key` header | full backfill: replaces the D1 cache from Webflow |
| `/api/webflow-webhook?key=` | POST | shared secret in URL | real-time sync — **only usable with a custom domain** (unused today) |

> `/api/contact-lookup` returns `403` if called from anywhere other than the live site (no `Origin`/`Referer` match). That's intentional — testing it in a browser address bar will 403.

---

## Project layout

```
src/
  pages/
    health.ts            GET  /api/health
    contact-lookup.ts    GET  /api/contact-lookup
    webflow-webhook.ts   POST /api/webflow-webhook   (built; needs a custom domain)
    admin/sync.ts        POST /api/admin/sync
  lib/
    config.ts            site/collection IDs + CMS field→column map + email normalize
    env.ts               typed runtime bindings (DB, optional RATE_LIMIT) + secrets
    http.ts              JSON/CORS helpers, same-origin check, constant-time compare
    ratelimit.ts         KV-backed per-IP limiter (no-ops if no KV bound)
    webflow.ts           Webflow Data API client (fetch-only; resolves references)
    store.ts             Drizzle queries against D1 (find/upsert/delete/replaceAll)
  db/schema.ts           Drizzle table definition for `contacts`
migrations/0000_init.sql contacts table + unique index on email (runs on deploy)
embed/contact-autofill.html  the <link>+<script> loader to paste into Webflow
.github/workflows/sync.yml   scheduled GitHub Action that calls /api/admin/sync
wrangler.json            Cloudflare bindings (D1) + worker config
astro.config.mjs         output: server, base: /api, CSRF origin-check disabled
```

---

## Configuration (live values)

In `src/lib/config.ts`:

- Site ID: `69ef8bfcc47da17447b4ed2b`
- Contacts collection: `6a1f7c72210b21e4677a6515`
- Organizations: `6a1f7c795cfaae86a5d55c93` · Regions: `6a1f672c59188a4545ced660`

Secrets (set in **Webflow Cloud → your project → Environment Variables**, marked *secret*):

| Name | What it's for | Where it comes from |
|---|---|---|
| `WEBFLOW_API_TOKEN` | lets the app read Contacts from Webflow (needs **CMS read**) | Webflow → Site Settings → Apps & integrations → API access → generate token |
| `ADMIN_SYNC_KEY` | protects `/api/admin/sync` | you invent it: `openssl rand -hex 32` |
| `WEBFLOW_WEBHOOK_SECRET` | protects `/api/webflow-webhook` | you invent it (currently unused — only needed with a custom domain) |

`ADMIN_SYNC_KEY` must **also** be added as a GitHub **repo secret** (Settings → Secrets and variables → Actions) so the scheduled sync can authenticate.

---

## Deploying (what was done, and how to redeploy)

Webflow Cloud builds from this repo on GitHub (`essexsolutions/api`) automatically on push.

1. **Create the project** in Webflow Cloud from this repo, **mount path `/api`** (must match `base` in `astro.config.mjs`).
2. **Create the database:** in Webflow Cloud → Storage, create a **SQLite (D1)** database with binding name **exactly `DB`**. Webflow assigns its `database_id` on deploy (the placeholder in `wrangler.json` is replaced).
3. **Add the three secrets** (table above).
4. **Deploy** (push to `main`, or hit redeploy). Migrations in `migrations/` run automatically and create the `contacts` table.
5. **Verify:** open `/api/health` → `{"ok":true,"contacts":N,...}`.

> Pushing: this repo's GitHub remote is the `essexsolutions` org, accessed through the **`github-essex`** SSH alias (`git@github-essex:essexsolutions/api.git`).

---

## Keeping D1 in sync

**Active method — scheduled GitHub Action** (`.github/workflows/sync.yml`):
- Re-runs `/api/admin/sync` every ~5 minutes (5 min is GitHub cron's practical floor; this repo is public so Actions minutes are free).
- **Run it instantly** any time: GitHub → Actions → "Sync contacts to D1" → **Run workflow**. Do this right after adding a contact you don't want to wait ~5 min for.
- Requires the `ADMIN_SYNC_KEY` repo secret.

**Why not a webhook?** Webflow rejects webhook destinations on `*.webflow.io` with *"Validation Error: Invalid hostname"* (both the dashboard and the API). The site has no custom domain, so the webhook can't be registered yet.

**To switch to real-time later** (after adding a custom domain like `essexsolutions.com`):
1. Register webhooks at Webflow → Site Settings → Apps & integrations → Webhooks (or via API), URL `https://YOUR-DOMAIN/api/webflow-webhook?key=YOUR_WEBFLOW_WEBHOOK_SECRET`, triggers `collection_item_created` / `_changed` / `_deleted` / `_unpublished`.
2. Disable the GitHub Action. The handler already ignores non-Contacts collections.

---

## The `/contact` page (Webflow side)

1. Delete the Jetboost results **Collection List** from the page.
2. On the `#Email` field, remove the class **`jetboost-list-search-input-6xn5`** (this is what disabled Submit).
3. **Page Settings → Before `</body>`**, paste the loader (see [`embed/contact-autofill.html`](embed/contact-autofill.html)), pinned to a tagged release of `essex-tools`:
   ```html
   <link rel="stylesheet"
     href="https://cdn.jsdelivr.net/gh/essexsolutions/essex-tools@v2.1.0/essex-email-autofill.css">
   <script
     src="https://cdn.jsdelivr.net/gh/essexsolutions/essex-tools@v2.1.0/essex-email-autofill.js"></script>
   ```
4. Publish.

The front-end script is maintained in **`essexsolutions/essex-tools`**, not here. To change autofill behavior, edit it there, cut a new tag (e.g. `v2.0.1`), and bump the `@v…` in the snippet above.

---

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars     # fill WEBFLOW_API_TOKEN / ADMIN_SYNC_KEY / WEBFLOW_WEBHOOK_SECRET
npm run db:migrate:local           # create the table in a local D1
npm run dev                        # astro dev with local bindings
```

Useful scripts: `npm run build`, `npm run check` (astro type-check), `npm run db:migrate:remote`.

Type-checking uses `@cloudflare/workers-types` (no need for `wrangler types`, which can't run without resource IDs that Webflow assigns).

---

## Day-to-day operation

- **Add/edit a contact:** do it in the Webflow **Contacts** CMS collection (email goes in the item **Name**). It appears in autofill within ~5 min, or immediately if you run the sync workflow manually.
- **Force a refresh:** Actions → "Sync contacts to D1" → Run workflow, or
  ```sh
  curl -X POST https://essexsolutions.webflow.io/api/admin/sync \
    -H "x-admin-key: YOUR_KEY" -H "Content-Type: application/json"
  # -> {"ok":true,"synced":N}
  ```
- **Check health:** open `/api/health`.

---

## Troubleshooting (issues we actually hit)

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health` → `Cannot read properties of undefined (reading 'prepare')` | D1 not bound — `env.DB` undefined | `wrangler.json` D1 binding needs a `database_id` field; create the DB with binding name `DB` and redeploy. `/api/health` lists `bindingsSeen` to diagnose. |
| `Cross-site POST form submissions are forbidden` | Astro's CSRF origin check | disabled via `security.checkOrigin: false` in `astro.config.mjs`; or send `Content-Type: application/json` |
| Webhook: `Validation Error: Invalid hostname` | Webflow blocks webhooks to `*.webflow.io` | use the scheduled GitHub Action; switch to webhook only with a custom domain |
| `/api/contact-lookup` returns `403` in the browser | same-origin gate (by design) | only the live `/contact` page may call it |

---

## Design notes

- **Security:** the lookup is same-origin-only and (optionally) IP rate-limited. It is, by design, an "email → contact details" oracle — that's the feature. Add Cloudflare Turnstile if you want to harden against enumeration. The app uses no cookies/sessions, so CSRF isn't a threat (hence `checkOrigin` off).
- **Edge runtime:** use `fetch` only — no `axios` or Node SDK clients.
- **Migrations are additive-only** once deployed: add `0001_*.sql`, never edit `0000_init.sql`.
- **Rate-limit KV is optional:** if no KV namespace is bound, the limiter no-ops and the lookup still works. Bind a KV namespace as `RATE_LIMIT` to enable throttling.
