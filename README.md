# essex-api

Edge API for the Essex Solutions site, hosted on **Webflow Cloud** (Astro + Cloudflare Workers + D1).

Its job: replace the old Jetboost on-page contact list with a **server-side email lookup**, so contact PII is never shipped to the browser and the lookup scales past Webflow's 100-item collection-list limit.

## How it works

```
Webflow CMS "Contacts" ──(full sync, one-time)──►  D1 table `contacts` (email indexed)
        └──(webhook on item create/update/delete)──►  upsert / delete
                                                            ▲
/contact form, #Email blur ─ fetch /api/contact-lookup ─────┘
        └─ returns ONLY the one matching contact → autofills step 2/3
```

- **Webflow CMS stays the source of truth.** D1 is a denormalized read cache. `organization` and `region` (CMS reference fields) are resolved to names at sync time so the lookup is a single indexed query.
- The email is stored in the Contacts **`name`** field (e.g. `jane@acme.com`); we mirror it lowercased into `contacts.email`.

## Routes (served under the `/api` mount path)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/contact-lookup?email=` | GET | same-origin + IP rate limit | the form calls this; returns `{match, contact}` |
| `/api/webflow-webhook?key=` | POST | shared secret | keeps D1 in sync on CMS changes |
| `/api/admin/sync` | POST | `x-admin-key` header | one-shot full backfill |
| `/api/health` | GET | — | row count / liveness |

## First-time setup

1. **Install + local run**
   ```sh
   npm install
   cp .dev.vars.example .dev.vars   # fill in the three secrets
   npm run cf-typegen               # generates worker-configuration.d.ts
   npm run db:migrate:local
   npm run dev
   ```

2. **Deploy to Webflow Cloud**
   - Push this repo to `git@github.com:essexsolutions/api.git` (already the origin).
   - In Webflow → **Webflow Cloud** → create a project from this GitHub repo.
   - Set the **mount path to `/api`** (must match `base` in `astro.config.mjs`).
   - Create the storage resources and bind them (names must match `wrangler.json`):
     - D1 database `essex-contacts` → binding `DB`
     - KV namespace → binding `RATE_LIMIT`
   - Add **Environment Variables** (mark secrets): `WEBFLOW_API_TOKEN`, `WEBFLOW_WEBHOOK_SECRET`, `ADMIN_SYNC_KEY`.
   - Deploy. Migrations in `./migrations` run automatically on deploy.

3. **Backfill the data once**
   ```sh
   curl -X POST https://essexsolutions.webflow.io/api/admin/sync \
     -H "x-admin-key: $ADMIN_SYNC_KEY"
   # -> { "ok": true, "synced": N }
   ```

4. **Wire the webhook** (Webflow → Site Settings → Apps & Integrations → Webhooks)
   - URL: `https://essexsolutions.webflow.io/api/webflow-webhook?key=YOUR_WEBFLOW_WEBHOOK_SECRET`
   - Triggers: `collection_item_created`, `collection_item_changed`, `collection_item_deleted`, `collection_item_unpublished`.

5. **Update the `/contact` page in Webflow**
   - Delete the Jetboost results **Collection List** from the page.
   - Remove the `jetboost-list-search-input-6xn5` class from the `#Email` field
     (this class is what let Jetboost disable the Submit button — see the original bug).
   - Load the autofill front-end from jsDelivr (its source of truth is the
     `essexsolutions/essex-tools` repo — `essex-email-autofill.js` + `.css`).
     See [`embed/contact-autofill.html`](embed/contact-autofill.html) for the exact
     `<link>` + `<script>` block to paste into **Page Settings → Before `</body>`**
     (replacing the old `essex-jetboost-autofill` embed).

## Notes / decisions

- **Security:** lookup is same-origin only + per-IP rate limited (30/min) to blunt email enumeration. It's still an "email → contact" oracle by design (that's the autofill feature); tighten with Cloudflare Turnstile if needed.
- **Edge runtime:** use `fetch` only — no axios / Node SDK clients.
- **Migrations are additive-only** once deployed; add `0001_*.sql` rather than editing `0000_init.sql`.
- IDs in `src/lib/config.ts` are the live Essex site/collection IDs.
