-- Essex contacts mirror.
-- Denormalized, single-table, point-lookup by email. Webflow CMS stays the
-- source of truth; this table is a read cache kept in sync by the webhook +
-- the admin full-sync endpoint.
--
-- Migrations are additive-only on Webflow Cloud: never edit or delete this file
-- after it has been deployed. Add a new 0001_*.sql for schema changes.

CREATE TABLE IF NOT EXISTS contacts (
  item_id      TEXT PRIMARY KEY,          -- Webflow CMS item id (stable key)
  email        TEXT NOT NULL,             -- normalized: lower(trim(name field))
  first_name   TEXT,
  last_name    TEXT,
  city         TEXT,
  phone        TEXT,
  role         TEXT,
  organization TEXT,                       -- resolved Organizations.name
  region       TEXT,                       -- resolved Regions.name
  updated_at   TEXT                        -- ISO timestamp of last sync
);

-- The index that makes the lookup O(log n) instead of a table scan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
