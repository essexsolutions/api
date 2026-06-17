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
  try {
    const [{ n }] = await db(env)
      .select({ n: sql<number>`count(*)` })
      .from(contacts);
    return json({ ok: true, contacts: n });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
};
