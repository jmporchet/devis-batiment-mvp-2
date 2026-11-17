import { formatAmount, parseChf } from "@/domain/money";
import { MAX_QUANTITY, formatQuantity, parseQuantity } from "@/domain/quantity";
import {
  CATEGORIES,
  type Category,
  type PriceItem,
  type QuoteLine,
  type Unit,
} from "@/domain/types";

/**
 * Brouillon d'une ligne dans l'éditeur : les champs de saisie restent du
 * texte tant que l'utilisateur tape, pour ne jamais perdre une saisie
 * invalide. Fonctions pures, testées.
 */
export interface LineDraft {
  /** Clé stable côté client (ne vient pas de la base). */
  key: string;
  priceItemId: string | null;
  label: string;
  unit: Unit;
  quantityText: string;
  /** Vide = « à chiffrer ». */
  priceText: string;
  source: "ai" | "manual";
}

export interface LineErrors {
  label?: string;
  quantity?: string;
  price?: string;
}

const MAX_PRICE_CENTS = 100_000_000;
/** Plafond de quantité (centièmes) × prix (centimes), loin sous la limite des entiers sûrs. */
const MAX_LINE_PRODUCT = 1e13;

export function draftFromLine(line: QuoteLine, key: string): LineDraft {
  return {
    key,
    priceItemId: line.priceItemId,
    label: line.label,
    unit: line.unit,
    quantityText: formatQuantity(line.quantity),
    priceText: line.unitPriceCents === null ? "" : formatAmount(line.unitPriceCents),
    source: line.source,
  };
}

/** Nouvelle ligne depuis la grille : libellé, unité et prix copiés, quantité 1. */
export function draftFromPriceItem(item: PriceItem, key: string): LineDraft {
  return {
    key,
    priceItemId: item.id,
    label: item.label,
    unit: item.unit,
    quantityText: "1",
    priceText: formatAmount(item.unitPriceCents),
    source: "manual",
  };
}

/** Nouvelle ligne hors grille : prix à chiffrer. */
export function draftOffGrid(label: string, unit: Unit, key: string): LineDraft {
  return {
    key,
    priceItemId: null,
    label: label.trim(),
    unit,
    quantityText: "1",
    priceText: "",
    source: "manual",
  };
}

export function validateDraft(draft: LineDraft): LineErrors {
  const errors: LineErrors = {};
  if (draft.label.trim() === "") errors.label = "Le libellé est obligatoire.";
  else if (draft.label.trim().length > 300) errors.label = "300 caractères au maximum.";

  const quantity = parseQuantity(draft.quantityText);
  if (quantity === null) {
    errors.quantity =
      draft.quantityText.trim() === ""
        ? "Saisissez une quantité."
        : "Quantité invalide (2 décimales au maximum, p. ex. 6,5).";
  } else if (Math.abs(quantity) > MAX_QUANTITY) {
    errors.quantity = "Quantité trop grande.";
  }

  if (draft.priceText.trim() !== "") {
    const cents = parseChf(draft.priceText);
    if (cents === null) errors.price = "Prix invalide (p. ex. 125 ou 125.50).";
    else if (cents < 0) errors.price = "Le prix ne peut pas être négatif.";
    else if (cents > MAX_PRICE_CENTS) errors.price = "Prix trop élevé.";
    else if (quantity !== null && Math.abs(quantity * 100 * cents) > MAX_LINE_PRODUCT) {
      errors.price = "Montant de la ligne trop élevé.";
    }
  }
  return errors;
}

export function hasErrors(errors: LineErrors): boolean {
  return Boolean(errors.label || errors.quantity || errors.price);
}

/** Ligne du domaine, ou null si la saisie est invalide. */
export function draftToLine(draft: LineDraft): QuoteLine | null {
  if (hasErrors(validateDraft(draft))) return null;
  return {
    priceItemId: draft.priceItemId,
    label: draft.label.trim(),
    unit: draft.unit,
    quantity: parseQuantity(draft.quantityText)!,
    unitPriceCents: draft.priceText.trim() === "" ? null : parseChf(draft.priceText),
    source: draft.source,
  };
}

export interface ConvertedDrafts {
  /** Lignes valides, dans l'ordre, pour les totaux. */
  validLines: QuoteLine[];
  /** Toutes les lignes, seulement si tout est valide (sinon null). */
  lines: QuoteLine[] | null;
  /** Erreurs par clé de brouillon (seulement les lignes en erreur). */
  errors: Record<string, LineErrors>;
  invalidCount: number;
}

export function convertDrafts(drafts: LineDraft[]): ConvertedDrafts {
  const validLines: QuoteLine[] = [];
  const errors: Record<string, LineErrors> = {};
  for (const draft of drafts) {
    const e = validateDraft(draft);
    if (hasErrors(e)) errors[draft.key] = e;
    else validLines.push(draftToLine(draft)!);
  }
  const invalidCount = Object.keys(errors).length;
  return { validLines, lines: invalidCount === 0 ? validLines : null, errors, invalidCount };
}

/**
 * Empreinte d'une liste de brouillons, pour savoir si elle diffère de la
 * dernière version enregistrée. Une saisie valide est comparée par sa valeur
 * (« 6,5 » et « 6.5 » sont égaux), une saisie invalide par son texte.
 */
export function draftsSignature(drafts: LineDraft[]): string {
  return JSON.stringify(
    drafts.map((d) => {
      const quantity = parseQuantity(d.quantityText);
      const price = d.priceText.trim() === "" ? null : parseChf(d.priceText);
      return [
        d.priceItemId,
        d.label,
        d.unit,
        quantity ?? `?${d.quantityText}`,
        d.priceText.trim() === "" ? null : (price ?? `?${d.priceText}`),
        d.source,
      ];
    }),
  );
}

/** Déplace un élément d'un cran (-1 = vers le haut, 1 = vers le bas). Ne modifie pas l'original. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Filtre les postes sur le libellé ou le code, sans tenir compte de la casse
 * ni des accents. Plusieurs mots : tous doivent se trouver.
 */
export function filterPriceItems(items: readonly PriceItem[], query: string): PriceItem[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const haystack = normalize(`${item.id} ${item.label}`);
    return words.every((w) => haystack.includes(w));
  });
}

export function groupByCategory(
  items: readonly PriceItem[],
): { category: Category; items: PriceItem[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}
