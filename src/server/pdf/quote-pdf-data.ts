import { formatAmount } from "@/domain/money";
import { formatQuantity } from "@/domain/quantity";
import { lineTotalCents } from "@/domain/pricing";
import { UNIT_LABELS, type Company, type Quote, type QuoteLine, type QuoteTotals } from "@/domain/types";
import { formatDateCh } from "@/lib/format-date";

/**
 * Logique pure du PDF de devis (sans @react-pdf) : testée à part.
 * Les notes internes du devis (`quote.notes`) ne passent jamais par ce module.
 */

const CANTONS = new Set([
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
]);

/** « 1020 Renens VD » → « Renens » (sans NPA ni canton). */
export function localityFromPostalCity(postalCity: string): string {
  let text = postalCity.trim().replace(/\s+/g, " ");
  text = text.replace(/^(?:[A-Z]{1,2}[- ])?\d{4}\s*/, "");
  const parts = text.split(" ");
  if (parts.length > 1 && CANTONS.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ").trim();
}

/** Date calendaire (année, mois, jour) à Zurich, pour éviter tout décalage de fuseau. */
function zurichCalendarDay(date: Date): { y: number; m: number; d: number } {
  const [d, m, y] = formatDateCh(date).split(".").map(Number);
  return { y, m, d };
}

/** Date limite de l'offre : date du devis + `validityDays` jours calendaires. */
export function validityEndDate(quoteDate: Date, validityDays: number): Date {
  const { y, m, d } = zurichCalendarDay(quoteDate);
  // Midi UTC : reste le même jour calendaire à Zurich, été comme hiver.
  return new Date(Date.UTC(y, m - 1, d + validityDays, 12));
}

/** « Offre valable 30 jours, jusqu'au 17.12.2026 » */
export function validityText(quoteDate: Date, validityDays: number): string {
  const unit = validityDays === 1 ? "jour" : "jours";
  return `Offre valable ${validityDays} ${unit}, jusqu’au ${formatDateCh(validityEndDate(quoteDate, validityDays))}`;
}

/** « Renens, le 17.11.2026 » (« Le 17.11.2026 » sans localité). */
export function placeAndDate(company: Company, quoteDate: Date): string {
  const locality = localityFromPostalCity(company.postalCity);
  const date = formatDateCh(quoteDate);
  return locality ? `${locality}, le ${date}` : `Le ${date}`;
}

export interface PdfRow {
  position: number;
  label: string;
  quantity: string;
  unit: string;
  /** null = « à chiffrer ». */
  unitPrice: string | null;
  total: string | null;
}

export function buildRows(lines: QuoteLine[]): PdfRow[] {
  return lines.map((line, index) => {
    const total = lineTotalCents(line);
    return {
      position: index + 1,
      label: line.label,
      quantity: formatQuantity(line.quantity),
      unit: UNIT_LABELS[line.unit],
      unitPrice: line.unitPriceCents === null ? null : formatAmount(line.unitPriceCents),
      total: total === null ? null : formatAmount(total),
    };
  });
}

export function countUnpriced(lines: QuoteLine[]): number {
  return lines.filter((l) => l.unitPriceCents === null).length;
}

export function formatVatRate(rateBp: number): string {
  const pct = (rateBp / 100).toFixed(1).replace(".", ",");
  return `${pct} %`;
}

export function provisionalText(unpricedCount: number): string {
  return `Total provisoire : ${unpricedCount} ligne${unpricedCount > 1 ? "s" : ""} à chiffrer`;
}

export interface TotalsRow {
  label: string;
  /** Précision en petit sous le libellé (numéro IDE/TVA). */
  sublabel?: string;
  value: string;
  strong?: boolean;
}

/** Lignes du bloc de totaux ; les montants viennent de `computeTotals` uniquement. */
export function buildTotalsRows(totals: QuoteTotals, company: Company): TotalsRow[] {
  const rows: TotalsRow[] = [
    { label: "Sous-total HT", value: formatAmount(totals.subtotalCents) },
    {
      label: `TVA ${formatVatRate(totals.vatRateBp)}`,
      sublabel: company.vatNumber.trim() || undefined,
      value: formatAmount(totals.vatCents),
    },
  ];
  if (totals.roundingCents !== 0) {
    rows.push({ label: "Arrondi", value: formatAmount(totals.roundingCents) });
  }
  rows.push({ label: "Total TTC en CHF", value: formatAmount(totals.totalCents), strong: true });
  return rows;
}

/** Nom de fichier ASCII : « Devis-2026-001.pdf ». */
export function pdfFileName(quote: Pick<Quote, "number">): string {
  const safe = quote.number.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `Devis-${safe || "sans-numero"}.pdf`;
}

/** En-tête Content-Disposition inline ; ajoute `filename*` (UTF-8) si le nom n'est pas ASCII. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  if (ascii === fileName) return `inline; filename="${ascii}"`;
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
