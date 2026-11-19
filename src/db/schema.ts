import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Category, MediaKind, QuoteStatus, Unit } from "@/domain/types";

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

/** Devis. Le numéro lisible (« 2026-007 ») est séquentiel par année. */
export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull().unique(),
  title: text("title").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  clientAddress: text("client_address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").$type<QuoteStatus>().notNull().default("brouillon"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Lignes d'un devis. Le libellé, l'unité et le prix sont copiés depuis la
 * grille au moment de l'ajout : modifier la grille ne change pas un devis
 * existant. Quantité stockée en centièmes (entier).
 */
export const quoteLines = sqliteTable("quote_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  priceItemId: text("price_item_id").references(() => priceItems.id),
  label: text("label").notNull(),
  unit: text("unit").$type<Unit>().notNull(),
  quantityCenti: integer("quantity_centi").notNull(),
  /** null = « à chiffrer ». */
  unitPriceCents: integer("unit_price_cents"),
  source: text("source").$type<"ai" | "manual">().notNull().default("manual"),
});

/** Photos et notes vocales. Fichiers sur disque : MEDIA_DIR/<quoteId>/<fileName>. */
export const quoteMedia = sqliteTable("quote_media", {
  id: text("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  kind: text("kind").$type<MediaKind>().notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Coordonnées de l'entreprise (une seule ligne, id = 1). Logo stocké en base
 * (petit fichier, servi par /entreprise/logo).
 */
export const company = sqliteTable("company", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  street: text("street").notNull().default(""),
  postalCity: text("postal_city").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  vatNumber: text("vat_number").notNull().default(""),
  iban: text("iban").notNull().default(""),
  validityDays: integer("validity_days").notNull().default(30),
  paymentTerms: text("payment_terms").notNull().default(""),
  footerNote: text("footer_note").notNull().default(""),
  logo: blob("logo", { mode: "buffer" }),
  logoMimeType: text("logo_mime_type"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
