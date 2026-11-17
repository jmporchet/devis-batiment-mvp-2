import type { Centimes } from "./types";

/**
 * Formate un montant en centimes à la suisse : « 1'234.50 ».
 * Implémentation manuelle pour un rendu identique partout (serveur, PDF,
 * navigateur), indépendamment des données ICU installées.
 */
export function formatAmount(cents: Centimes): string {
  assertInteger(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const francs = Math.floor(abs / 100).toString();
  const rappen = (abs % 100).toString().padStart(2, "0");
  const grouped = francs.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${negative ? "-" : ""}${grouped}.${rappen}`;
}

/** « CHF 1'234.50 » */
export function formatChf(cents: Centimes): string {
  return `CHF ${formatAmount(cents)}`;
}

/**
 * Lit une saisie utilisateur (« 125 », « 125.5 », « 125,50 », « 1'250.00 »)
 * et renvoie des centimes, ou null si la saisie est invalide.
 */
export function parseChf(input: string): Centimes | null {
  const cleaned = input.trim().replace(/^CHF\s*/i, "").replace(/['’\s]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [intPart, decPart = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  return cleaned.startsWith("-") ? -cents : cents;
}

function assertInteger(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`Montant non entier en centimes : ${cents}`);
  }
}
