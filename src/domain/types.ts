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
