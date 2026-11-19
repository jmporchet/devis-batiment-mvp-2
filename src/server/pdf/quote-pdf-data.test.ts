import { describe, expect, it } from "vitest";
import { computeTotals } from "@/domain/pricing";
import { DEMO_COMPANY, type Company, type QuoteLine } from "@/domain/types";
import {
  buildRows,
  buildTotalsRows,
  contentDisposition,
  countUnpriced,
  localityFromPostalCity,
  pdfFileName,
  placeAndDate,
  provisionalText,
  validityEndDate,
  validityText,
} from "./quote-pdf-data";

const company: Company = { ...DEMO_COMPANY, hasLogo: false, updatedAt: new Date() };

const line = (over: Partial<QuoteLine> = {}): QuoteLine => ({
  priceItemId: "CAR-010",
  label: "Pose de carrelage",
  unit: "m2",
  quantity: 12.5,
  unitPriceCents: 12_345,
  source: "manual",
  ...over,
});

describe("localityFromPostalCity", () => {
  it("retire le NPA et le canton", () => {
    expect(localityFromPostalCity("1020 Renens VD")).toBe("Renens");
    expect(localityFromPostalCity("1003 Lausanne")).toBe("Lausanne");
    expect(localityFromPostalCity("1052 Le Mont-sur-Lausanne VD")).toBe("Le Mont-sur-Lausanne");
  });
  it("garde une localité qui ressemble à un canton si elle est seule", () => {
    expect(localityFromPostalCity("6000 Luzern LU")).toBe("Luzern");
    expect(localityFromPostalCity("Bex VD")).toBe("Bex");
    expect(localityFromPostalCity("VD")).toBe("VD");
  });
  it("gère le vide et les espaces", () => {
    expect(localityFromPostalCity("")).toBe("");
    expect(localityFromPostalCity("  1260   Nyon   VD ")).toBe("Nyon");
    expect(localityFromPostalCity("CH-1800 Vevey")).toBe("Vevey");
  });
});

describe("validité", () => {
  it("ajoute les jours calendaires", () => {
    const date = new Date("2026-11-17T09:00:00Z");
    expect(validityText(date, 30)).toBe("Offre valable 30 jours, jusqu’au 17.12.2026");
    expect(validityText(date, 1)).toBe("Offre valable 1 jour, jusqu’au 18.11.2026");
  });
  it("passe le changement d'année", () => {
    expect(validityText(new Date("2026-12-20T10:00:00Z"), 30)).toBe("Offre valable 30 jours, jusqu’au 19.01.2027");
  });
  it("utilise le jour calendaire de Zurich (23 h UTC = lendemain à Zurich)", () => {
    const lateEvening = new Date("2026-11-16T23:30:00Z"); // 17.11 00:30 à Zurich
    expect(validityEndDate(lateEvening, 0).toISOString().slice(0, 10)).toBe("2026-11-17");
  });
  it("passe le changement d'heure d'été", () => {
    expect(validityText(new Date("2026-03-20T08:00:00Z"), 14)).toBe("Offre valable 14 jours, jusqu’au 03.04.2026");
  });
});

describe("placeAndDate", () => {
  it("assemble localité et date", () => {
    expect(placeAndDate(company, new Date("2026-11-17T09:00:00Z"))).toBe("Renens, le 17.11.2026");
  });
  it("sans localité", () => {
    expect(placeAndDate({ ...company, postalCity: "" }, new Date("2026-11-17T09:00:00Z"))).toBe("Le 17.11.2026");
  });
});

describe("buildRows", () => {
  it("formate montants, quantités et unités à la suisse", () => {
    const [row] = buildRows([line()]);
    expect(row).toEqual({
      position: 1,
      label: "Pose de carrelage",
      quantity: "12.5",
      unit: "m²",
      unitPrice: "123.45",
      total: "1'543.13",
    });
  });
  it("ligne à chiffrer : pas de prix ni de total", () => {
    const [row] = buildRows([line({ unitPriceCents: null, unit: "forfait", quantity: 1 })]);
    expect(row.unitPrice).toBeNull();
    expect(row.total).toBeNull();
    expect(row.unit).toBe("forfait");
  });
  it("numérote à partir de 1", () => {
    expect(buildRows([line(), line(), line()]).map((r) => r.position)).toEqual([1, 2, 3]);
  });
});

describe("totaux", () => {
  it("n'affiche l'arrondi que s'il est non nul", () => {
    // 100.00 HT + 8.10 = 108.10 : pas d'arrondi
    const exact = computeTotals([line({ quantity: 1, unitPriceCents: 10_000 })]);
    expect(buildTotalsRows(exact, company).map((r) => r.label)).toEqual([
      "Sous-total HT",
      "TVA 8,1 %",
      "Total TTC en CHF",
    ]);
    // 10.03 HT + 0.81 = 10.84 -> 10.85 : arrondi +0.01
    const rounded = computeTotals([line({ quantity: 1, unitPriceCents: 1_003 })]);
    const rows = buildTotalsRows(rounded, company);
    expect(rows.map((r) => r.label)).toContain("Arrondi");
    expect(rows.find((r) => r.label === "Arrondi")?.value).toBe("0.01");
    expect(rows.at(-1)).toMatchObject({ label: "Total TTC en CHF", value: "10.85", strong: true });
  });
  it("joint le numéro IDE/TVA s'il existe", () => {
    const totals = computeTotals([line()]);
    expect(buildTotalsRows(totals, company)[1].sublabel).toBe("CHE-000.000.000 TVA");
    expect(buildTotalsRows(totals, { ...company, vatNumber: "  " })[1].sublabel).toBeUndefined();
  });
  it("compte les lignes à chiffrer", () => {
    const lines = [line(), line({ unitPriceCents: null }), line({ unitPriceCents: null })];
    expect(countUnpriced(lines)).toBe(2);
    expect(provisionalText(2)).toBe("Total provisoire : 2 lignes à chiffrer");
    expect(provisionalText(1)).toBe("Total provisoire : 1 ligne à chiffrer");
  });
});

describe("nom de fichier", () => {
  it("ASCII", () => {
    expect(pdfFileName({ number: "2026-001" })).toBe("Devis-2026-001.pdf");
    expect(pdfFileName({ number: "Été 2026/7" })).toBe("Devis-Ete-2026-7.pdf");
  });
  it("Content-Disposition", () => {
    expect(contentDisposition("Devis-2026-001.pdf")).toBe('inline; filename="Devis-2026-001.pdf"');
    expect(contentDisposition("Devis-Rénovation.pdf")).toBe(
      "inline; filename=\"Devis-Renovation.pdf\"; filename*=UTF-8''Devis-R%C3%A9novation.pdf",
    );
  });
});
