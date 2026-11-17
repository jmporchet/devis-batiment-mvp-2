import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Category, Unit } from "@/domain/types";

/** Grille de prix de l'entreprise (une seule entreprise pour le MVP). */
export const priceItems = sqliteTable("price_items", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  unit: text("unit").$type<Unit>().notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  category: text("category").$type<Category>().notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
