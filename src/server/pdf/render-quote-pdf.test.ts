import { describe, expect, it } from "vitest";
import { DEMO_COMPANY, type Company, type Quote, type QuoteLine } from "@/domain/types";
import { renderQuotePdf } from "./render-quote-pdf";

const company: Company = { ...DEMO_COMPANY, hasLogo: false, updatedAt: new Date() };

function quote(lineCount: number, status: Quote["status"]): Quote {
  const lines: QuoteLine[] = Array.from({ length: lineCount }, (_, i) => ({
    priceItemId: null,
    label: `Travaux n° ${i + 1} : pose, évacuation et finitions`,
    unit: "m2",
    quantity: 3.5,
    unitPriceCents: 12_500,
    source: "manual",
  }));
  return {
    id: 1,
    number: "2026-001",
    status,
    title: "Rénovation",
    clientName: "Mme Müller",
    clientAddress: "Rue du Lac 1\n1800 Vevey",
    notes: "NOTE-INTERNE",
    createdAt: new Date("2026-11-17T09:00:00Z"),
    updatedAt: new Date("2026-11-17T09:00:00Z"),
    lines,
    media: [],
  };
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("renderQuotePdf", () => {
  it("produit un PDF d'une page pour un petit devis", async () => {
    const pdf = await renderQuotePdf(quote(3, "valide"), company, null);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  }, 20_000);

  it("s'étend sur plusieurs pages pour un long devis, brouillon compris", async () => {
    const pdf = await renderQuotePdf(quote(60, "brouillon"), company, null);
    expect(pageCount(pdf)).toBeGreaterThan(1);
  }, 20_000);
});
