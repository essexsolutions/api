import { COLLECTIONS, CONTACT_FIELD, normalizeEmail } from "./config";

const API = "https://api.webflow.com/v2";

// Edge runtime: use `fetch` only (no axios / Node SDKs).
async function wf<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "accept-version": "2.0.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Webflow API ${res.status} on ${path}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface WfItem {
  id: string;
  isArchived?: boolean;
  isDraft?: boolean;
  fieldData: Record<string, any>;
}

// Build an id -> display name map for a reference collection (Organizations, Regions).
async function nameMap(token: string, collectionId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let offset = 0;
  for (;;) {
    const page = await wf<{ items: WfItem[]; pagination: { total: number } }>(
      token,
      `/collections/${collectionId}/items?limit=100&offset=${offset}`,
    );
    for (const it of page.items) map.set(it.id, it.fieldData?.name ?? "");
    offset += page.items.length;
    if (offset >= page.pagination.total || page.items.length === 0) break;
  }
  return map;
}

export interface ContactRecord {
  itemId: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  phone: string;
  role: string;
  organization: string;
  region: string;
}

function mapItem(
  item: WfItem,
  orgs: Map<string, string>,
  regions: Map<string, string>,
): ContactRecord {
  const f = item.fieldData ?? {};
  const orgRef = f[CONTACT_FIELD.organization];
  const regionRef = f[CONTACT_FIELD.region];
  return {
    itemId: item.id,
    email: normalizeEmail(f[CONTACT_FIELD.email]),
    firstName: f[CONTACT_FIELD.firstName] ?? "",
    lastName: f[CONTACT_FIELD.lastName] ?? "",
    city: f[CONTACT_FIELD.city] ?? "",
    phone: f[CONTACT_FIELD.phone] ?? "",
    role: f[CONTACT_FIELD.role] ?? "",
    organization: orgRef ? (orgs.get(orgRef) ?? "") : "",
    region: regionRef ? (regions.get(regionRef) ?? "") : "",
  };
}

// Pull every contact and resolve references — used by the admin full-sync.
export async function fetchAllContacts(token: string): Promise<ContactRecord[]> {
  const [orgs, regions] = await Promise.all([
    nameMap(token, COLLECTIONS.organizations),
    nameMap(token, COLLECTIONS.regions),
  ]);

  const out: ContactRecord[] = [];
  let offset = 0;
  for (;;) {
    const page = await wf<{ items: WfItem[]; pagination: { total: number } }>(
      token,
      `/collections/${COLLECTIONS.contacts}/items?limit=100&offset=${offset}`,
    );
    for (const it of page.items) {
      if (it.isArchived || it.isDraft) continue;
      const rec = mapItem(it, orgs, regions);
      if (rec.email) out.push(rec);
    }
    offset += page.items.length;
    if (offset >= page.pagination.total || page.items.length === 0) break;
  }
  return out;
}

// Resolve a single contact (used by the webhook). Only fetches the two small
// reference collections plus the one item.
export async function fetchContact(token: string, itemId: string): Promise<ContactRecord | null> {
  const [orgs, regions, item] = await Promise.all([
    nameMap(token, COLLECTIONS.organizations),
    nameMap(token, COLLECTIONS.regions),
    wf<WfItem>(token, `/collections/${COLLECTIONS.contacts}/items/${itemId}`).catch(() => null),
  ]);
  if (!item || item.isArchived || item.isDraft) return null;
  const rec = mapItem(item, orgs, regions);
  return rec.email ? rec : null;
}
