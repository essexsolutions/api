import type { APIRoute } from "astro";
import { getEnv } from "../../lib/env";
import { json, safeEqual } from "../../lib/http";
import { fetchAllContacts } from "../../lib/webflow";
import { replaceAll } from "../../lib/store";

export const prerender = false;

// POST /api/admin/sync   (header: x-admin-key: ADMIN_SYNC_KEY)
//
// One-shot full backfill: pulls every contact from Webflow, resolves the
// organization/region references to names, and replaces the D1 mirror.
// Run this once after first deploy, and any time you want to force a rebuild.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);

  const key = request.headers.get("x-admin-key") ?? "";
  if (!env.ADMIN_SYNC_KEY || !safeEqual(key, env.ADMIN_SYNC_KEY)) {
    return json({ error: "forbidden" }, { status: 403 });
  }
  if (!env.WEBFLOW_API_TOKEN) {
    return json({ error: "missing WEBFLOW_API_TOKEN" }, { status: 500 });
  }

  try {
    const recs = await fetchAllContacts(env.WEBFLOW_API_TOKEN);
    const count = await replaceAll(env, recs);
    return json({ ok: true, synced: count });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};
