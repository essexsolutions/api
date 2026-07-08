import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";
import { json } from "../lib/http";
import { db } from "../lib/store";
import { contacts } from "../db/schema";
import { sql } from "drizzle-orm";

export const prerender = false;

// GET /api/health  -> quick sanity check that the worker + D1 binding are live.
export const GET: APIRoute = async ({ locals }) => {
  const env = getEnv(locals);

  // Diagnostic: what bindings/vars can the app actually see right now?
  // (key NAMES only — never values; secrets are not exposed.)
  const seen = Object.keys(env || {}).sort();
  const has = {
    DB: !!env?.DB,
    RATE_LIMIT: !!env?.RATE_LIMIT,
    AIRTABLE_API_TOKEN: !!env?.AIRTABLE_API_TOKEN,
    ADMIN_SYNC_KEY: !!env?.ADMIN_SYNC_KEY,
  };

  if (!env?.DB) {
    return json(
      {
        ok: false,
        error: "DB binding not found — the SQLite database isn't bound as `DB`.",
        bindingsSeen: seen,
        has,
      },
      { status: 500 },
    );
  }

  try {
    const [{ n }] = await db(env)
      .select({ n: sql<number>`count(*)` })
      .from(contacts);
    return json({ ok: true, contacts: n, has });
  } catch (err) {
    return json({ ok: false, error: String(err), has }, { status: 500 });
  }
};
