import { eq } from "drizzle-orm";
import { z } from "zod";
import { CATEGORIES, UNITS, type Category, type PriceItem } from "@/domain/types";
import type { Db } from "./create-db";
import { priceItems } from "./schema";
import { PRICE_GRID_SEED } from "./seed/price-grid";

/** Préfixe du code de poste pour chaque catégorie. */
export const CATEGORY_CODE_PREFIX: Record<Category, string> = {
  demolition: "DEM",
  maconnerie: "MAC",
  carrelage: "CAR",
  sanitaire: "SAN",
  peinture: "PEI",
  electricite: "ELE",
  menuiserie: "MEN",
  divers: "DIV",
};

export const CODE_PATTERN = /^[A-Z]{3}-\d{3}$/;

/** Plafond de sécurité contre les fautes de frappe : CHF 1'000'000.00. */
const MAX_PRICE_CENTS = 100_000_000;

export type PriceItemField = "id" | "label" | "unit" | "unitPriceCents" | "category";

/** Erreur de validation ou de règle métier, message prêt à afficher en français. */
export class PriceItemError extends Error {
  readonly fieldErrors: Partial<Record<PriceItemField, string>>;

  constructor(message: string, fieldErrors: Partial<Record<PriceItemField, string>> = {}) {
    super(message);
    this.name = "PriceItemError";
    this.fieldErrors = fieldErrors;
  }
}

const fields = {
  label: z
    .string({ error: "Le libellé est obligatoire." })
    .trim()
    .min(1, "Le libellé est obligatoire.")
    .max(200, "Le libellé est trop long (200 caractères au maximum)."),
  unit: z.enum(UNITS, { error: "Unité inconnue." }),
  unitPriceCents: z
    .number({ error: "Le prix est invalide." })
    .int("Le prix doit être un nombre entier de centimes.")
    .min(0, "Le prix ne peut pas être négatif.")
    .max(MAX_PRICE_CENTS, "Le prix est trop élevé."),
  category: z.enum(CATEGORIES, { error: "Catégorie inconnue." }),
};

const createSchema = z.object({
  id: z
    .string({ error: "Le code est obligatoire." })
    .trim()
    .regex(CODE_PATTERN, "Le code doit avoir le format ABC-123 (trois lettres majuscules, un tiret, trois chiffres)."),
  ...fields,
});

const updateSchema = z.object(fields).partial();

export type NewPriceItem = z.input<typeof createSchema>;
export type PriceItemPatch = z.input<typeof updateSchema>;

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Partial<Record<PriceItemField, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as PriceItemField | undefined;
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = result.error.issues[0]?.message ?? "Données invalides.";
  throw new PriceItemError(first, fieldErrors);
}

function toPriceItem(row: typeof priceItems.$inferSelect): PriceItem {
  return {
    id: row.id,
    label: row.label,
    unit: row.unit,
    unitPriceCents: row.unitPriceCents,
    category: row.category,
    active: row.active,
  };
}

/** Postes triés par catégorie (ordre de `CATEGORIES`) puis par code. */
export function listPriceItems(
  db: Db,
  options: { includeInactive?: boolean } = {},
): PriceItem[] {
  const items = db.select().from(priceItems).all().map(toPriceItem);
  return items
    .filter((item) => options.includeInactive || item.active)
    .sort(
      (a, b) =>
        CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
        a.id.localeCompare(b.id),
    );
}

export function getPriceItem(db: Db, id: string): PriceItem | undefined {
  const row = db.select().from(priceItems).where(eq(priceItems.id, id)).get();
  return row ? toPriceItem(row) : undefined;
}

export function createPriceItem(db: Db, input: NewPriceItem): PriceItem {
  const data = parseOrThrow(createSchema, input);
  if (getPriceItem(db, data.id)) {
    throw new PriceItemError(`Le code ${data.id} existe déjà.`, {
      id: `Le code ${data.id} existe déjà.`,
    });
  }
  db.insert(priceItems).values({ ...data, active: true }).run();
  return getPriceItem(db, data.id)!;
}

/** Modifie un poste. Le code ne change jamais : les devis le référencent. */
export function updatePriceItem(db: Db, id: string, patch: PriceItemPatch): PriceItem {
  const data = parseOrThrow(updateSchema, patch);
  if (!getPriceItem(db, id)) throw new PriceItemError("Poste introuvable.");
  if (Object.keys(data).length > 0) {
    db.update(priceItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(priceItems.id, id))
      .run();
  }
  return getPriceItem(db, id)!;
}

/** Active ou désactive un poste (pas de suppression définitive). */
export function setPriceItemActive(db: Db, id: string, active: boolean): PriceItem {
  if (!getPriceItem(db, id)) throw new PriceItemError("Poste introuvable.");
  db.update(priceItems)
    .set({ active, updatedAt: new Date() })
    .where(eq(priceItems.id, id))
    .run();
  return getPriceItem(db, id)!;
}

/**
 * Prochain code libre d'une catégorie : dernier numéro utilisé arrondi à la
 * dizaine supérieure, plus 10 (CAR-070 donne CAR-080). Premier code : 010.
 * Au-delà de 990, cherche le premier numéro libre.
 */
export function suggestNextCode(db: Db, category: Category): string {
  const prefix = CATEGORY_CODE_PREFIX[category];
  const used = new Set<number>();
  for (const item of db.select({ id: priceItems.id }).from(priceItems).all()) {
    const match = new RegExp(`^${prefix}-(\\d{3})$`).exec(item.id);
    if (match) used.add(Number(match[1]));
  }
  const max = used.size ? Math.max(...used) : 0;
  let next = (Math.floor(max / 10) + 1) * 10;
  if (next > 999) {
    next = 1;
    while (used.has(next) && next < 999) next++;
  }
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

/** Insère la grille de départ si la table est vide. Renvoie le nombre de postes insérés. */
export function seedPriceGridIfEmpty(db: Db): number {
  return db.transaction((tx) => {
    if (tx.select({ id: priceItems.id }).from(priceItems).limit(1).get()) return 0;
    tx.insert(priceItems)
      .values(PRICE_GRID_SEED.map((item) => ({ ...item, active: true })))
      .run();
    return PRICE_GRID_SEED.length;
  });
}
