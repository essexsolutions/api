// Static identifiers for the Essex Solutions Airtable base ("Essex Website").
// (Discovered via the Airtable Meta API.)
export const AIRTABLE_BASE_ID = "appbcVBFejX0KdRQI";

export const TABLES = {
  contacts: "tbl0VVC8fPix0wtye",
  organizations: "tblwG9v0g6uwmyItV",
  regions: "tblCzw8xnaNcQhyFu",
} as const;

// Map of Airtable Contacts field name -> our D1 column.
// The email lives in the `Email Address` field (the table's primary field);
// `organization` and `region` are linked records resolved to their primary
// (`Name`) at sync time.
export const CONTACT_FIELD = {
  email: "Email Address",
  firstName: "First Name",
  lastName: "Last Name",
  city: "City / Province",
  phone: "Phone",
  role: "Role", // single-select -> stored as its label
  organization: "Organization", // linked -> Organizations.Name
  region: "Region", // linked -> Regions.Name
} as const;

// The primary/display field on the Organizations and Regions tables.
export const REF_NAME_FIELD = "Name";

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}
