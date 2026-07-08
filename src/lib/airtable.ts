import {
  AIRTABLE_BASE_ID,
  CONTACT_FIELD,
  REF_NAME_FIELD,
  TABLES,
  normalizeEmail,
} from "./config";

const API = "https://api.airtable.com/v0";

// Edge runtime: use `fetch` only (no Node SDKs). Thin Airtable REST client.
async function at<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Airtable API ${res.status} on ${path}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface AtRecord {
  id: string;
  fields: Record<string, any>;
}

interface AtPage {
  records: AtRecord[];
  offset?: string;
}

// Page through an entire table (100 rows/page), calling `fn` on each record.
// `params` is an already-encoded query string (without a leading `?`), or "".
async function eachRecord(
  token: string,
  tableId: string,
  params: string,
  fn: (r: AtRecord) => void,
): Promise<void> {
  let offset: string | undefined;
  do {
    const query = ["pageSize=100", params, offset ? `offset=${offset}` : ""]
      .filter(Boolean)
      .join("&");
    const page = await at<AtPage>(token, `/${AIRTABLE_BASE_ID}/${tableId}?${query}`);
    for (const r of page.records) fn(r);
    offset = page.offset;
  } while (offset);
}

// Build a record-id -> display name map for a linked table (Organizations, Regions).
async function nameMap(token: string, tableId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const params = `fields%5B%5D=${encodeURIComponent(REF_NAME_FIELD)}`;
  await eachRecord(token, tableId, params, (r) => {
    map.set(r.id, r.fields?.[REF_NAME_FIELD] ?? "");
  });
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

// Linked-record fields come back as arrays of record ids; resolve the first.
function firstLinked(value: unknown, names: Map<string, string>): string {
  if (Array.isArray(value) && value.length) return names.get(value[0]) ?? "";
  return "";
}

function mapRecord(
  rec: AtRecord,
  orgs: Map<string, string>,
  regions: Map<string, string>,
): ContactRecord {
  const f = rec.fields ?? {};
  return {
    itemId: rec.id,
    email: normalizeEmail(f[CONTACT_FIELD.email]),
    firstName: f[CONTACT_FIELD.firstName] ?? "",
    lastName: f[CONTACT_FIELD.lastName] ?? "",
    city: f[CONTACT_FIELD.city] ?? "",
    phone: f[CONTACT_FIELD.phone] ?? "",
    role: f[CONTACT_FIELD.role] ?? "",
    organization: firstLinked(f[CONTACT_FIELD.organization], orgs),
    region: firstLinked(f[CONTACT_FIELD.region], regions),
  };
}

// Pull every contact and resolve links — used by the admin full-sync.
export async function fetchAllContacts(token: string): Promise<ContactRecord[]> {
  const [orgs, regions] = await Promise.all([
    nameMap(token, TABLES.organizations),
    nameMap(token, TABLES.regions),
  ]);

  const out: ContactRecord[] = [];
  await eachRecord(token, TABLES.contacts, "", (rec) => {
    const mapped = mapRecord(rec, orgs, regions);
    if (mapped.email) out.push(mapped);
  });
  return out;
}
