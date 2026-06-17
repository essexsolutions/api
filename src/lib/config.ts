// Static identifiers for the Essex Solutions Webflow site.
// (Discovered via the Webflow Data API. Override via env vars if they ever change.)
export const SITE_ID = "69ef8bfcc47da17447b4ed2b";

export const COLLECTIONS = {
  contacts: "6a1f7c72210b21e4677a6515",
  organizations: "6a1f7c795cfaae86a5d55c93",
  regions: "6a1f672c59188a4545ced660",
} as const;

// Map of Webflow Contacts field slug -> our D1 column.
// The email lives in the `name` field; `organization` and `region` are
// references resolved to their display names at sync time.
export const CONTACT_FIELD = {
  email: "name",
  firstName: "first-name",
  lastName: "last-name",
  city: "city",
  phone: "phone",
  role: "role",
  organization: "organization", // reference -> Organizations.name
  region: "region", // reference -> Regions.name
} as const;

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}
