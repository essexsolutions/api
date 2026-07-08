import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { contacts } from "../db/schema";
import type { ContactRecord } from "./airtable";
import type { Env } from "./env";

export function db(env: Env) {
  return drizzle(env.DB);
}

export async function upsertContact(env: Env, rec: ContactRecord): Promise<void> {
  const row = {
    itemId: rec.itemId,
    email: rec.email,
    firstName: rec.firstName,
    lastName: rec.lastName,
    city: rec.city,
    phone: rec.phone,
    role: rec.role,
    organization: rec.organization,
    region: rec.region,
    updatedAt: new Date().toISOString(),
  };
  await db(env)
    .insert(contacts)
    .values(row)
    .onConflictDoUpdate({ target: contacts.itemId, set: row });
}

export async function deleteContact(env: Env, itemId: string): Promise<void> {
  await db(env).delete(contacts).where(eq(contacts.itemId, itemId));
}

export async function findByEmail(env: Env, email: string) {
  const rows = await db(env)
    .select()
    .from(contacts)
    .where(eq(contacts.email, email))
    .limit(1);
  return rows[0] ?? null;
}

// Bulk replace — used by the admin full-sync. D1 caps bound parameters at 100
// per query, and each row binds one param per column. With 10 columns that's
// max 10 rows/insert; we use 9 (90 params) to stay safely under the limit.
export async function replaceAll(env: Env, recs: ContactRecord[]): Promise<number> {
  const d = db(env);
  await d.delete(contacts);
  const now = new Date().toISOString();
  const CHUNK = 9;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const slice = recs.slice(i, i + CHUNK).map((r) => ({
      itemId: r.itemId,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      city: r.city,
      phone: r.phone,
      role: r.role,
      organization: r.organization,
      region: r.region,
      updatedAt: now,
    }));
    if (slice.length) await d.insert(contacts).values(slice);
  }
  return recs.length;
}
