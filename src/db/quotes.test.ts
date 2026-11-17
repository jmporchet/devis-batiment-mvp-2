import { beforeEach, describe, expect, it } from "vitest";
import type { QuoteLine } from "@/domain/types";
import { createDb, type Db } from "./create-db";
import { seedPriceGridIfEmpty } from "./price-items";
import {
  addQuoteMedia,
  createQuote,
  deleteQuote,
  getQuote,
  getQuoteMediaFile,
  listQuotes,
  QuoteError,
  replaceQuoteLines,
  setQuoteStatus,
  updateQuoteInfo,
} from "./quotes";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  seedPriceGridIfEmpty(db);
});

const line = (over: Partial<QuoteLine> = {}): QuoteLine => ({
  priceItemId: "CAR-010",
  label: "Carrelage de sol",
  unit: "m2",
  quantity: 6.5,
  unitPriceCents: 13_500,
  source: "manual",
  ...over,
});

const media = (kind: "photo" | "audio", n = 1) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  kind,
  fileName: `00000000-0000-4000-8000-00000000000${n}.${kind === "photo" ? "jpg" : "webm"}`,
  mimeType: kind === "photo" ? "image/jpeg" : "audio/webm",
  sizeBytes: 1234,
});

describe("createQuote", () => {
  it("crée un brouillon vide numéroté par année", () => {
    const a = createQuote(db, {}, new Date("2026-03-01"));
    const b = createQuote(db, { title: "Salle de bain" }, new Date("2026-03-02"));
    const c = createQuote(db, {}, new Date("2027-01-05"));
    expect([a.number, b.number, c.number]).toEqual(["2026-001", "2026-002", "2027-001"]);
    expect(b).toMatchObject({ title: "Salle de bain", status: "brouillon", lines: [], media: [] });
  });

  it("continue la numérotation après une suppression", () => {
    createQuote(db, {}, new Date("2026-03-01"));
    const b = createQuote(db, {}, new Date("2026-03-01"));
    deleteQuote(db, 1);
    expect(createQuote(db, {}, new Date("2026-03-01")).number).toBe("2026-003");
    expect(getQuote(db, b.id)).toBeDefined();
  });
});

describe("médias", () => {
  it("accepte 3 photos et 1 note vocale, refuse au-delà", () => {
    const q = createQuote(db);
    for (const n of [1, 2, 3]) addQuoteMedia(db, q.id, media("photo", n));
    expect(() => addQuoteMedia(db, q.id, media("photo", 4))).toThrow(QuoteError);
    addQuoteMedia(db, q.id, media("audio", 5));
    expect(() => addQuoteMedia(db, q.id, media("audio", 6))).toThrow(/Une seule note vocale/);
    expect(getQuote(db, q.id)!.media.map((m) => m.kind)).toEqual(["photo", "photo", "photo", "audio"]);
  });

  it("ne renvoie un média que pour son devis", () => {
    const q1 = createQuote(db);
    const q2 = createQuote(db);
    addQuoteMedia(db, q1.id, media("photo"));
    expect(getQuoteMediaFile(db, q1.id, media("photo").id)?.fileName).toBe(media("photo").fileName);
    expect(getQuoteMediaFile(db, q2.id, media("photo").id)).toBeUndefined();
  });
});

describe("replaceQuoteLines", () => {
  it("enregistre les lignes dans l'ordre, quantités décimales exactes", () => {
    const q = createQuote(db);
    const saved = replaceQuoteLines(db, q.id, [
      line(),
      line({ priceItemId: null, label: "Niche murale sur mesure", unit: "pce", quantity: 1, unitPriceCents: null }),
      line({ priceItemId: "DIV-010", label: "Régie", unit: "h", quantity: 0.33, unitPriceCents: 9_500 }),
    ]);
    expect(saved.lines.map((l) => [l.label, l.quantity])).toEqual([
      ["Carrelage de sol", 6.5],
      ["Niche murale sur mesure", 1],
      ["Régie", 0.33],
    ]);
    // Remplacement complet
    expect(replaceQuoteLines(db, q.id, [line()]).lines).toHaveLength(1);
    expect(replaceQuoteLines(db, q.id, []).lines).toHaveLength(0);
  });

  it("refuse les lignes invalides avec un message indiquant la ligne", () => {
    const q = createQuote(db);
    expect(() => replaceQuoteLines(db, q.id, [line(), line({ label: " " })])).toThrow(/Ligne 2/);
    expect(() => replaceQuoteLines(db, q.id, [line({ quantity: 1.234 })])).toThrow(/2 décimales/);
    expect(() => replaceQuoteLines(db, q.id, [line({ unitPriceCents: -1 })])).toThrow(/négatif/);
    expect(() => replaceQuoteLines(db, q.id, [line({ priceItemId: "XXX-999" })])).toThrow(/introuvable/);
    expect(() => replaceQuoteLines(db, q.id, [line({ unit: "km" as never })])).toThrow(/Unité/);
    expect(getQuote(db, q.id)!.lines).toHaveLength(0);
  });

  it("accepte une remise (quantité négative)", () => {
    const q = createQuote(db);
    const saved = replaceQuoteLines(db, q.id, [line({ priceItemId: null, label: "Remise", unit: "forfait", quantity: -1, unitPriceCents: 10_000 })]);
    expect(saved.lines[0].quantity).toBe(-1);
  });
});

describe("statut", () => {
  it("valide seulement un devis complet et le verrouille", () => {
    const q = createQuote(db);
    expect(() => setQuoteStatus(db, q.id, "valide")).toThrow(/au moins une ligne/);
    replaceQuoteLines(db, q.id, [line(), line({ priceItemId: null, unitPriceCents: null })]);
    expect(() => setQuoteStatus(db, q.id, "valide")).toThrow(/à chiffrer/);
    replaceQuoteLines(db, q.id, [line()]);
    expect(setQuoteStatus(db, q.id, "valide").status).toBe("valide");
    expect(() => replaceQuoteLines(db, q.id, [])).toThrow(/validé/);
    expect(() => updateQuoteInfo(db, q.id, { clientName: "X" })).toThrow(/validé/);
    setQuoteStatus(db, q.id, "brouillon");
    expect(updateQuoteInfo(db, q.id, { clientName: "  Mme Rochat " }).clientName).toBe("Mme Rochat");
  });
});

describe("listQuotes", () => {
  it("liste les devis, le plus récent d'abord, avec totaux et médias", async () => {
    const a = createQuote(db, { title: "A" });
    const b = createQuote(db, { title: "B" });
    await new Promise((r) => setTimeout(r, 5));
    replaceQuoteLines(db, a.id, [line({ quantity: 10, unitPriceCents: 10_000 })]);
    addQuoteMedia(db, b.id, media("photo"));
    addQuoteMedia(db, b.id, media("audio", 2));
    await new Promise((r) => setTimeout(r, 5));
    replaceQuoteLines(db, a.id, [line({ quantity: 10, unitPriceCents: 10_000 })]);

    const list = listQuotes(db);
    expect(list.map((q) => q.title)).toEqual(["A", "B"]);
    // 1000.00 HT + TVA 81.00 = 1081.00
    expect(list[0].totals).toMatchObject({ subtotalCents: 100_000, vatCents: 8_100, totalCents: 108_100 });
    expect(list[1]).toMatchObject({ lineCount: 0, photoCount: 1, hasAudio: true });
  });
});
