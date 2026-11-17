/**
 * Saisie et affichage des quantités d'un devis. Fonctions pures.
 * Une quantité a au maximum 2 décimales ; les quantités négatives sont
 * acceptées (remises).
 */

/** Quantité maximale acceptée par le serveur (valeur absolue). */
export const MAX_QUANTITY = 1_000_000;

/**
 * Lit une saisie (« 6,5 », « 6.5 », « 1'000 », « -1 ») et renvoie le nombre,
 * ou null si la saisie est invalide (vide, texte, plus de 2 décimales).
 */
export function parseQuantity(input: string): number | null {
  const cleaned = input.trim().replace(/['’\s]/g, "").replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, intPart, decPart = ""] = match;
  const hundredths = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(hundredths)) return null;
  if (hundredths === 0) return 0;
  return (sign ? -hundredths : hundredths) / 100;
}

/** Affiche une quantité sans zéros inutiles : 6.5 → « 6.5 », 1 → « 1 », 0.33 → « 0.33 ». */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Quantité invalide : ${n}`);
  const hundredths = Math.round(n * 100);
  if (hundredths === 0) return "0";
  const abs = Math.abs(hundredths);
  const int = Math.floor(abs / 100);
  const dec = String(abs % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${hundredths < 0 ? "-" : ""}${int}${dec ? `.${dec}` : ""}`;
}
