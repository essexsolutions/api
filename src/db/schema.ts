import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable(
  "contacts",
  {
    itemId: text("item_id").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    city: text("city"),
    phone: text("phone"),
    role: text("role"),
    organization: text("organization"),
    region: text("region"),
    updatedAt: text("updated_at"),
  },
  (t) => [uniqueIndex("idx_contacts_email").on(t.email)],
);

export type ContactRow = typeof contacts.$inferSelect;
