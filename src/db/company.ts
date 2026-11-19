import { eq } from "drizzle-orm";
import { z } from "zod";
import { DEMO_COMPANY, type Company, type CompanyInfo } from "@/domain/types";
import type { Db } from "./create-db";
import { QuoteError } from "./quotes";
import { company } from "./schema";

/**
 * Coordonnées de l'entreprise (une seule ligne). Au premier accès, la ligne
 * est créée avec les valeurs de démonstration `DEMO_COMPANY`.
 */

const ROW_ID = 1;
/** Logo : PNG ou JPEG (formats lus par le moteur PDF), 1 Mo au plus. */
export const MAX_LOGO_BYTES = 1024 * 1024;

function ensureRow(db: Db) {
  const row = db.select().from(company).where(eq(company.id, ROW_ID)).get();
  if (row) return row;
  db.insert(company).values({ id: ROW_ID, ...DEMO_COMPANY, updatedAt: new Date() }).run();
  return db.select().from(company).where(eq(company.id, ROW_ID)).get()!;
}

export function getCompany(db: Db): Company {
  const row = ensureRow(db);
  return {
    name: row.name,
    street: row.street,
    postalCity: row.postalCity,
    phone: row.phone,
    email: row.email,
    website: row.website,
    vatNumber: row.vatNumber,
    iban: row.iban,
    validityDays: row.validityDays,
    paymentTerms: row.paymentTerms,
    footerNote: row.footerNote,
    hasLogo: row.logo !== null && row.logo.length > 0,
    updatedAt: row.updatedAt,
  };
}

export function getCompanyLogo(db: Db): { bytes: Buffer; mimeType: string } | null {
  const row = ensureRow(db);
  if (!row.logo || row.logo.length === 0 || !row.logoMimeType) return null;
  return { bytes: Buffer.from(row.logo), mimeType: row.logoMimeType };
}

const short = (max: number, label: string) =>
  z.string().trim().max(max, `${label} : ${max} caractères au maximum.`);

const infoSchema = z.object({
  name: z.string().trim().min(1, "La raison sociale est obligatoire.").max(120, "Raison sociale : 120 caractères au maximum."),
  street: short(120, "Rue"),
  postalCity: short(120, "NPA et localité"),
  phone: short(40, "Téléphone"),
  email: z
    .string()
    .trim()
    .max(120, "E-mail : 120 caractères au maximum.")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Adresse e-mail invalide."),
  website: short(120, "Site web"),
  vatNumber: short(40, "Numéro IDE / TVA"),
  iban: short(42, "IBAN"),
  validityDays: z
    .number({ error: "Validité invalide." })
    .int("La validité est un nombre entier de jours.")
    .min(1, "La validité doit être d'au moins 1 jour.")
    .max(365, "La validité ne peut pas dépasser 365 jours."),
  paymentTerms: short(120, "Conditions de paiement"),
  footerNote: short(1000, "Remarques"),
});

export function updateCompany(db: Db, patch: Partial<CompanyInfo>): Company {
  const result = infoSchema.partial().safeParse(patch);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new QuoteError(result.error.issues[0]?.message ?? "Données invalides.", fieldErrors);
  }
  ensureRow(db);
  db.update(company).set({ ...result.data, updatedAt: new Date() }).where(eq(company.id, ROW_ID)).run();
  return getCompany(db);
}

function logoMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.toString("latin1", 1, 4) === "PNG") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/** Remplace le logo (PNG ou JPEG, vérifié par signature) ou le retire (null). */
export function setCompanyLogo(db: Db, bytes: Buffer | null): Company {
  ensureRow(db);
  if (bytes === null || bytes.length === 0) {
    db.update(company).set({ logo: null, logoMimeType: null, updatedAt: new Date() }).where(eq(company.id, ROW_ID)).run();
    return getCompany(db);
  }
  if (bytes.length > MAX_LOGO_BYTES) throw new QuoteError("Le logo dépasse 1 Mo.", { logo: "Le logo dépasse 1 Mo." });
  const mimeType = logoMimeType(bytes);
  if (!mimeType) {
    throw new QuoteError("Le logo doit être une image PNG ou JPEG.", { logo: "Le logo doit être une image PNG ou JPEG." });
  }
  db.update(company).set({ logo: bytes, logoMimeType: mimeType, updatedAt: new Date() }).where(eq(company.id, ROW_ID)).run();
  return getCompany(db);
}
