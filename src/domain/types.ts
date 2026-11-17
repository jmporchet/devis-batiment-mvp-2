/**
 * Types du domaine partagés par toute l'application.
 *
 * Règle d'or : tous les montants sont des entiers en centimes (CHF).
 * Aucun calcul monétaire en virgule flottante, aucun prix produit par l'IA.
 */

/** Montant en centimes de CHF. Toujours un entier. */
export type Centimes = number;

export const UNITS = ["m2", "ml", "m3", "pce", "h", "forfait"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  m2: "m²",
  ml: "m",
  m3: "m³",
  pce: "pce",
  h: "h",
  forfait: "forfait",
};

export const CATEGORIES = [
  "demolition",
  "maconnerie",
  "carrelage",
  "sanitaire",
  "peinture",
  "electricite",
  "menuiserie",
  "divers",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  demolition: "Démolition et évacuation",
  maconnerie: "Maçonnerie et chapes",
  carrelage: "Carrelage et faïence",
  sanitaire: "Installations sanitaires",
  peinture: "Peinture et plâtrerie",
  electricite: "Électricité",
  menuiserie: "Menuiserie",
  divers: "Divers",
};

/** Poste de la grille de prix de l'entreprise. */
export interface PriceItem {
  /** Code stable et lisible, p. ex. "CAR-010". */
  id: string;
  label: string;
  unit: Unit;
  unitPriceCents: Centimes;
  category: Category;
  active: boolean;
}

/** Ligne d'un devis. */
export interface QuoteLine {
  /** Poste de la grille, ou null si le travail n'existe pas dans la grille. */
  priceItemId: string | null;
  label: string;
  unit: Unit;
  /** Quantité, au maximum 2 décimales (p. ex. 6.5 m²). */
  quantity: number;
  /** null = « à chiffrer » : poste hors grille, prix à saisir par l'humain. */
  unitPriceCents: Centimes | null;
  /** Origine de la ligne, utile pour la relecture. */
  source: "ai" | "manual";
}

/** Taux de TVA suisse normal, en points de base (8,1 % = 810). */
export const VAT_RATE_BP = 810;

export interface QuoteTotals {
  /** Somme des lignes chiffrées, HT. */
  subtotalCents: Centimes;
  vatRateBp: number;
  vatCents: Centimes;
  /** Ajustement d'arrondi aux 5 centimes (peut être négatif). */
  roundingCents: Centimes;
  /** Total TTC arrondi aux 5 centimes. */
  totalCents: Centimes;
  /** Vrai si au moins une ligne est « à chiffrer » : le total est incomplet. */
  hasUnpricedLines: boolean;
}

/* ---------- Devis ---------- */

export const QUOTE_STATUSES = ["brouillon", "valide"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  brouillon: "Brouillon",
  valide: "Validé",
};

export const MEDIA_KINDS = ["photo", "audio"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Nombre maximal de photos par devis. */
export const MAX_PHOTOS = 3;
/** Durée maximale d'une note vocale, en secondes (cible : environ 30 s). */
export const MAX_AUDIO_SECONDS = 60;

/** Photo ou note vocale jointe à un devis. */
export interface QuoteMedia {
  /** UUID, utilisé dans l'URL /devis/[id]/media/[mediaId]. */
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

/** Infos modifiables d'un devis (hors lignes). */
export interface QuoteInfo {
  /** Objet du devis, p. ex. « Rénovation salle de bain ». */
  title: string;
  clientName: string;
  clientAddress: string;
  /** Notes libres ; recevra la transcription de la note vocale (étape IA). */
  notes: string;
}

export interface Quote extends QuoteInfo {
  id: number;
  /** Numéro lisible, p. ex. « 2026-007 ». */
  number: string;
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
  lines: QuoteLine[];
  media: QuoteMedia[];
}

/** Ligne de la liste des devis. */
export interface QuoteSummary {
  id: number;
  number: string;
  title: string;
  clientName: string;
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
  lineCount: number;
  photoCount: number;
  hasAudio: boolean;
  totals: QuoteTotals;
}
