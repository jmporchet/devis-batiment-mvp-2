import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { computeTotals } from "@/domain/pricing";
import {
  MAX_PHOTOS,
  UNITS,
  type MediaKind,
  type Quote,
  type QuoteInfo,
  type QuoteLine,
  type QuoteMedia,
  type QuoteStatus,
  type QuoteSummary,
} from "@/domain/types";
import type { Db } from "./create-db";
import { getPriceItem } from "./price-items";
import { quoteLines, quoteMedia, quotes } from "./schema";

/** Erreur de validation ou de règle métier, message prêt à afficher en français. */
export class QuoteError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "QuoteError";
    this.fieldErrors = fieldErrors;
  }
}

/* ---------- Conversions ---------- */

function toLine(row: typeof quoteLines.$inferSelect): QuoteLine {
  return {
    priceItemId: row.priceItemId,
    label: row.label,
    unit: row.unit,
    quantity: row.quantityCenti / 100,
    unitPriceCents: row.unitPriceCents,
    source: row.source,
  };
}

function toMedia(row: typeof quoteMedia.$inferSelect): QuoteMedia {
  return {
    id: row.id,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

/* ---------- Lecture ---------- */

export function getQuote(db: Db, id: number): Quote | undefined {
  const row = db.select().from(quotes).where(eq(quotes.id, id)).get();
  if (!row) return undefined;
  const lines = db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, id))
    .orderBy(asc(quoteLines.position))
    .all()
    .map(toLine);
  const media = db
    .select()
    .from(quoteMedia)
    .where(eq(quoteMedia.quoteId, id))
    .orderBy(asc(quoteMedia.createdAt))
    .all()
    .map(toMedia);
  const { id: _id, number, title, clientName, clientAddress, notes, status, createdAt, updatedAt } =
    row;
  return {
    id: _id,
    number,
    title,
    clientName,
    clientAddress,
    notes,
    status,
    createdAt,
    updatedAt,
    lines,
    media,
  };
}

/** Tous les devis, le plus récemment modifié en premier, avec leurs totaux. */
export function listQuotes(db: Db): QuoteSummary[] {
  const rows = db.select().from(quotes).orderBy(desc(quotes.updatedAt), desc(quotes.id)).all();
  return rows.map((row) => {
    const lines = db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, row.id))
      .all()
      .map(toLine);
    const media = db
      .select({ kind: quoteMedia.kind })
      .from(quoteMedia)
      .where(eq(quoteMedia.quoteId, row.id))
      .all();
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      clientName: row.clientName,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lineCount: lines.length,
      photoCount: media.filter((m) => m.kind === "photo").length,
      hasAudio: media.some((m) => m.kind === "audio"),
      totals: computeTotals(lines),
    };
  });
}

/** Média d'un devis, avec le nom du fichier sur disque. Vérifie l'appartenance. */
export function getQuoteMediaFile(
  db: Db,
  quoteId: number,
  mediaId: string,
): (QuoteMedia & { fileName: string }) | undefined {
  const row = db
    .select()
    .from(quoteMedia)
    .where(and(eq(quoteMedia.quoteId, quoteId), eq(quoteMedia.id, mediaId)))
    .get();
  return row ? { ...toMedia(row), fileName: row.fileName } : undefined;
}

/* ---------- Création ---------- */

/** Prochain numéro de l'année : « 2026-001 », « 2026-002 »… */
function nextNumber(db: Db, year: number): string {
  const prefix = `${year}-`;
  const row = db
    .select({ max: sql<string | null>`max(${quotes.number})` })
    .from(quotes)
    .where(like(quotes.number, `${prefix}%`))
    .get();
  const last = row?.max ? Number(row.max.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(3, "0")}`;
}

/** Crée un devis brouillon vide. */
export function createQuote(db: Db, info: Partial<QuoteInfo> = {}, now = new Date()): Quote {
  const data = parseOrThrow(infoSchema.partial(), info);
  const id = db.transaction((tx) => {
    const number = nextNumber(tx as unknown as Db, now.getFullYear());
    return tx
      .insert(quotes)
      .values({ ...data, number, status: "brouillon", createdAt: now, updatedAt: now })
      .returning({ id: quotes.id })
      .get().id;
  });
  return getQuote(db, id)!;
}

/** Enregistre un média déjà écrit sur disque. Max MAX_PHOTOS photos et 1 note vocale. */
export function addQuoteMedia(
  db: Db,
  quoteId: number,
  media: { id: string; kind: MediaKind; fileName: string; mimeType: string; sizeBytes: number },
): QuoteMedia {
  const quote = requireQuote(db, quoteId);
  const count = quote.media.filter((m) => m.kind === media.kind).length;
  if (media.kind === "photo" && count >= MAX_PHOTOS) {
    throw new QuoteError(`${MAX_PHOTOS} photos au maximum par devis.`);
  }
  if (media.kind === "audio" && count >= 1) {
    throw new QuoteError("Une seule note vocale par devis.");
  }
  const now = new Date();
  db.insert(quoteMedia).values({ ...media, quoteId, createdAt: now }).run();
  touch(db, quoteId, now);
  return getQuoteMediaFile(db, quoteId, media.id)!;
}

/* ---------- Modification ---------- */

const infoSchema = z.object({
  title: z.string().trim().max(200, "L'objet est limité à 200 caractères."),
  clientName: z.string().trim().max(200, "Le nom est limité à 200 caractères."),
  clientAddress: z.string().trim().max(500, "L'adresse est limitée à 500 caractères."),
  notes: z.string().trim().max(5000, "Les notes sont limitées à 5000 caractères."),
});

export function updateQuoteInfo(db: Db, id: number, info: Partial<QuoteInfo>): Quote {
  const data = parseOrThrow(infoSchema.partial(), info);
  requireEditable(db, id);
  db.update(quotes).set({ ...data, updatedAt: new Date() }).where(eq(quotes.id, id)).run();
  return getQuote(db, id)!;
}

const MAX_QUANTITY_CENTI = 100_000_000; // 1'000'000 unités
const MAX_PRICE_CENTS = 100_000_000; // CHF 1'000'000.00

const lineSchema = z.object({
  priceItemId: z.string().nullable(),
  label: z
    .string()
    .trim()
    .min(1, "Chaque ligne doit avoir un libellé.")
    .max(300, "Un libellé de ligne est limité à 300 caractères."),
  unit: z.enum(UNITS, { error: "Unité inconnue." }),
  quantity: z
    .number({ error: "Quantité invalide." })
    .finite("Quantité invalide.")
    .refine((q) => Math.abs(q * 100 - Math.round(q * 100)) < 1e-6, "2 décimales au maximum.")
    .refine((q) => Math.abs(Math.round(q * 100)) <= MAX_QUANTITY_CENTI, "Quantité trop grande."),
  unitPriceCents: z
    .number()
    .int("Prix invalide.")
    .min(0, "Le prix ne peut pas être négatif.")
    .max(MAX_PRICE_CENTS, "Prix trop élevé.")
    .nullable(),
  source: z.enum(["ai", "manual"]),
});

/**
 * Remplace toutes les lignes d'un devis (l'écran de relecture enregistre la
 * liste complète). Les quantités négatives sont acceptées (remises).
 */
export function replaceQuoteLines(db: Db, id: number, lines: QuoteLine[]): Quote {
  requireEditable(db, id);
  if (lines.length > 200) throw new QuoteError("200 lignes au maximum par devis.");
  const parsed = lines.map((line, index) => {
    const result = lineSchema.safeParse(line);
    if (!result.success) {
      const message = `Ligne ${index + 1} : ${result.error.issues[0]?.message ?? "invalide."}`;
      throw new QuoteError(message, { [`lines.${index}`]: message });
    }
    const data = result.data;
    if (data.priceItemId !== null && !getPriceItem(db, data.priceItemId)) {
      const message = `Ligne ${index + 1} : poste ${data.priceItemId} introuvable dans la grille.`;
      throw new QuoteError(message, { [`lines.${index}`]: message });
    }
    return data;
  });
  db.transaction((tx) => {
    tx.delete(quoteLines).where(eq(quoteLines.quoteId, id)).run();
    if (parsed.length > 0) {
      tx.insert(quoteLines)
        .values(
          parsed.map((line, position) => ({
            quoteId: id,
            position,
            priceItemId: line.priceItemId,
            label: line.label,
            unit: line.unit,
            quantityCenti: Math.round(line.quantity * 100),
            unitPriceCents: line.unitPriceCents,
            source: line.source,
          })),
        )
        .run();
    }
    tx.update(quotes).set({ updatedAt: new Date() }).where(eq(quotes.id, id)).run();
  });
  return getQuote(db, id)!;
}

/**
 * Change le statut. Valider exige au moins une ligne et aucune ligne
 * « à chiffrer ». Un devis validé n'est plus modifiable tant qu'il n'est pas
 * repassé en brouillon.
 */
export function setQuoteStatus(db: Db, id: number, status: QuoteStatus): Quote {
  const quote = requireQuote(db, id);
  if (status === "valide") {
    if (quote.lines.length === 0) {
      throw new QuoteError("Ajoutez au moins une ligne avant de valider le devis.");
    }
    if (quote.lines.some((l) => l.unitPriceCents === null)) {
      throw new QuoteError("Chiffrez toutes les lignes « à chiffrer » avant de valider le devis.");
    }
  }
  db.update(quotes).set({ status, updatedAt: new Date() }).where(eq(quotes.id, id)).run();
  return getQuote(db, id)!;
}

/**
 * Supprime un devis et ses lignes et médias en base (cascade). Les fichiers
 * sur disque sont à supprimer par l'appelant (`removeQuoteMediaDir`).
 */
export function deleteQuote(db: Db, id: number): void {
  db.delete(quotes).where(eq(quotes.id, id)).run();
}

/**
 * Supprime un brouillon (lignes et médias en base). Un devis validé ne peut
 * pas être supprimé : il a pu être envoyé à un client. Renvoie son numéro.
 * Les fichiers sur disque sont à supprimer par l'appelant.
 */
export function deleteDraftQuote(db: Db, id: number): string {
  const quote = requireQuote(db, id);
  if (quote.status === "valide") {
    throw new QuoteError("Un devis validé ne peut pas être supprimé. Repassez-le d'abord en brouillon.");
  }
  deleteQuote(db, id);
  return quote.number;
}

/* ---------- Utilitaires ---------- */

function requireQuote(db: Db, id: number): Quote {
  const quote = getQuote(db, id);
  if (!quote) throw new QuoteError("Devis introuvable.");
  return quote;
}

function requireEditable(db: Db, id: number): Quote {
  const quote = requireQuote(db, id);
  if (quote.status === "valide") {
    throw new QuoteError("Ce devis est validé. Repassez-le en brouillon pour le modifier.");
  }
  return quote;
}

function touch(db: Db, id: number, now = new Date()) {
  db.update(quotes).set({ updatedAt: now }).where(eq(quotes.id, id)).run();
}

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new QuoteError(result.error.issues[0]?.message ?? "Données invalides.", fieldErrors);
}
