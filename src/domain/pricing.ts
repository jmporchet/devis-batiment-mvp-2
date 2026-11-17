import type { Centimes, QuoteLine, QuoteTotals } from "./types";
import { VAT_RATE_BP } from "./types";

/**
 * Moteur de calcul des devis. Fonctions pures, entiers uniquement :
 * les quantités sont converties en centièmes avant tout produit.
 */

/** Division entière arrondie à la moitié supérieure en valeur absolue (symétrique). */
function divRoundHalfAwayFromZero(numerator: number, denominator: number): number {
  const abs = Math.abs(numerator);
  let quotient = Math.floor(abs / denominator);
  if ((abs % denominator) * 2 >= denominator) quotient += 1;
  if (quotient === 0) return 0;
  return numerator < 0 ? -quotient : quotient;
}

function assertSafeInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${what} doit être un entier : ${value}`);
  }
}

/**
 * Total d'une ligne en centimes, ou null si la ligne est « à chiffrer ».
 * Quantité à 2 décimales au maximum ; arrondi commercial au centime.
 */
export function lineTotalCents(line: QuoteLine): Centimes | null {
  const { quantity, unitPriceCents } = line;
  if (!Number.isFinite(quantity)) {
    throw new Error(`Quantité invalide : ${quantity}`);
  }
  const hundredths = Math.round(quantity * 100);
  // Tolérance : 1.15 * 100 = 114.99999999999999 en float, mais reste à 2 décimales.
  if (Math.abs(quantity * 100 - hundredths) > 1e-6) {
    throw new Error(`Quantité avec plus de 2 décimales : ${quantity}`);
  }
  if (unitPriceCents === null) return null;
  assertSafeInteger(unitPriceCents, "Le prix unitaire en centimes");
  const product = hundredths * unitPriceCents;
  assertSafeInteger(product, "Le produit quantité × prix");
  return divRoundHalfAwayFromZero(product, 100);
}

/** Arrondi suisse aux 5 centimes les plus proches (symétrique pour les négatifs). */
export function roundTo5Cents(cents: Centimes): Centimes {
  assertSafeInteger(cents, "Le montant en centimes");
  const abs = Math.abs(cents);
  const remainder = abs % 5;
  const rounded = remainder <= 2 ? abs - remainder : abs + (5 - remainder);
  if (rounded === 0) return 0;
  return cents < 0 ? -rounded : rounded;
}

/** TVA en centimes, arrondie au centime (moitié vers le haut). `rateBp` en points de base. */
export function vatCents(subtotalCents: Centimes, rateBp: number): Centimes {
  assertSafeInteger(subtotalCents, "Le sous-total en centimes");
  assertSafeInteger(rateBp, "Le taux en points de base");
  const product = subtotalCents * rateBp;
  assertSafeInteger(product, "Le produit sous-total × taux");
  return divRoundHalfAwayFromZero(product, 10_000);
}

/**
 * Totaux d'un devis. La TVA est calculée sur le sous-total (pas ligne par
 * ligne) et le TTC est arrondi aux 5 centimes.
 */
export function computeTotals(
  lines: QuoteLine[],
  vatRateBp: number = VAT_RATE_BP,
): QuoteTotals {
  let subtotalCents = 0;
  let hasUnpricedLines = false;
  for (const line of lines) {
    const total = lineTotalCents(line);
    if (total === null) hasUnpricedLines = true;
    else subtotalCents += total;
  }
  const vat = vatCents(subtotalCents, vatRateBp);
  const exact = subtotalCents + vat;
  const totalCents = roundTo5Cents(exact);
  return {
    subtotalCents,
    vatRateBp,
    vatCents: vat,
    roundingCents: totalCents - exact,
    totalCents,
    hasUnpricedLines,
  };
}
