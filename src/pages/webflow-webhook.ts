import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";
import { json, safeEqual } from "../lib/http";
import { fetchContact } from "../lib/webflow";
import { deleteContact, upsertContact } from "../lib/store";

export const prerender = false;

// POST /api/webflow-webhook?key=SHARED_SECRET
//
// Wire this URL into Webflow → Site Settings → Apps & Integrations → Webhooks
// for these triggers:
//   collection_item_created, collection_item_changed,
//   collection_item_deleted, collection_item_unpublished
//
// Webflow lets you set an arbitrary URL, so we guard with a shared secret in the
// query string (compared in constant time). This works whether or not the
// webhook is signed, which keeps it reliable for token-created site webhooks.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);

  const provided = new URL(request.url).searchParams.get("key") ?? "";
  if (!env.WEBFLOW_WEBHOOK_SECRET || !safeEqual(provided, env.WEBFLOW_WEBHOOK_SECRET)) {
    return json({ error: "forbidden" }, { status: 403 });
  }
  if (!env.WEBFLOW_API_TOKEN) {
    return json({ error: "missing WEBFLOW_API_TOKEN" }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, { status: 400 });
  }

  // Webflow v2 webhook payload shape: { triggerType, payload: { id, collectionId, ... } }
  const triggerType: string = body?.triggerType ?? "";
  const payload = body?.payload ?? body;
  const itemId: string | undefined = payload?.id ?? payload?.itemId;
  if (!itemId) return json({ error: "no_item_id" }, { status: 400 });

  try {
    if (
      triggerType === "collection_item_deleted" ||
      triggerType === "collection_item_unpublished"
    ) {
      await deleteContact(env, itemId);
      return json({ ok: true, action: "deleted", itemId });
    }

    // created / changed -> re-fetch the item (with references resolved) and upsert.
    const rec = await fetchContact(env.WEBFLOW_API_TOKEN, itemId);
    if (!rec) {
      // Item is now a draft / archived / emailless -> remove from the cache.
      await deleteContact(env, itemId);
      return json({ ok: true, action: "removed_inactive", itemId });
    }
    await upsertContact(env, rec);
    return json({ ok: true, action: "upserted", itemId });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};
