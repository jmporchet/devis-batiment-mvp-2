import { describe, expect, it } from "vitest";
import { computeTotals } from "@/domain/pricing";
import type { PriceItem, QuoteLine } from "@/domain/types";
import {
  convertDrafts,
  draftFromLine,
  draftFromPriceItem,
  draftOffGrid,
  draftToLine,
  draftsSignature,
  filterPriceItems,
  groupByCategory,
  moveItem,
  validateDraft,
} from "./line-drafts";

const carrelage: PriceItem = {
  id: "CAR-010",
  label: "Pose de carrelage au sol",
  unit: "m2",
  unitPriceCents: 13_950,
  category: "carrelage",
  active: true,
};
const demolition: PriceItem = {
  id: "DEM-050",
  label: "Évacuation des gravats",
  unit: "m3",
  unitPriceCents: 22_000,
  category: "demolition",
  active: true,
};

describe("draftFromPriceItem", () => {
  it("copie libellé, unité et prix, quantité 1", () => {
    const draft = draftFromPriceItem(carrelage, "k1");
    expect(draft).toMatchObject({
      key: "k1",
      priceItemId: "CAR-010",
      label: "Pose de carrelage au sol",
      unit: "m2",
      quantityText: "1",
      priceText: "139.50",
      source: "manual",
    });
    expect(draftToLine(draft)).toEqual({
      priceItemId: "CAR-010",
      label: "Pose de carrelage au sol",
      unit: "m2",
      quantity: 1,
      unitPriceCents: 13_950,
      source: "manual",
    });
  });
});

describe("draftOffGrid", () => {
  it("n'a ni poste ni prix", () => {
    const line = draftToLine(draftOffGrid("  Dépose d'un velux ", "pce", "k2"));
    expect(line).toMatchObject({ priceItemId: null, label: "Dépose d'un velux", unitPriceCents: null });
  });
});

describe("validateDraft", () => {
  const base = draftFromPriceItem(carrelage, "k");
  it("accepte une virgule et signale une saisie invalide", () => {
    expect(validateDraft({ ...base, quantityText: "6,5" })).toEqual({});
    expect(validateDraft({ ...base, quantityText: "1.234" }).quantity).toBeTruthy();
    expect(validateDraft({ ...base, quantityText: "" }).quantity).toBeTruthy();
    expect(validateDraft({ ...base, quantityText: "2000000" }).quantity).toBeTruthy();
  });
  it("accepte une quantité négative (remise)", () => {
    expect(validateDraft({ ...base, quantityText: "-1" })).toEqual({});
  });
  it("prix vide = à chiffrer, prix invalide ou négatif refusé", () => {
    expect(validateDraft({ ...base, priceText: "" })).toEqual({});
    expect(validateDraft({ ...base, priceText: "12x" }).price).toBeTruthy();
    expect(validateDraft({ ...base, priceText: "-5" }).price).toBeTruthy();
  });
  it("refuse un libellé vide", () => {
    expect(validateDraft({ ...base, label: "  " }).label).toBeTruthy();
  });
});

describe("convertDrafts", () => {
  it("sépare lignes valides et erreurs, sans perdre la saisie", () => {
    const a = draftFromPriceItem(carrelage, "a");
    const b = { ...draftFromPriceItem(demolition, "b"), quantityText: "abc" };
    const result = convertDrafts([a, b]);
    expect(result.lines).toBeNull();
    expect(result.invalidCount).toBe(1);
    expect(result.errors.b?.quantity).toBeTruthy();
    expect(result.validLines).toHaveLength(1);
    expect(b.quantityText).toBe("abc");
  });

  it("calcule le TTC attendu : 6,5 m² à 139.50 + 1 forfait à chiffrer", () => {
    const a = { ...draftFromPriceItem(carrelage, "a"), quantityText: "6,5" };
    const b = draftOffGrid("Divers", "forfait", "b");
    const { lines } = convertDrafts([a, b]);
    const totals = computeTotals(lines!);
    // 6.5 × 139.50 = 906.75 ; TVA 8,1 % = 73.45 (73.44675) ; 980.20 → arrondi 980.20
    expect(totals.subtotalCents).toBe(90_675);
    expect(totals.vatCents).toBe(7_345);
    expect(totals.totalCents).toBe(98_020);
    expect(totals.hasUnpricedLines).toBe(true);
  });
});

describe("draftsSignature", () => {
  const a = draftFromPriceItem(carrelage, "a");
  it("ignore la clé et la forme de saisie équivalente", () => {
    const x = { ...a, quantityText: "6,5" };
    const y = { ...a, key: "autre", quantityText: "6.50" };
    expect(draftsSignature([x])).toBe(draftsSignature([y]));
  });
  it("change quand le contenu ou l'ordre change", () => {
    const b = draftFromPriceItem(demolition, "b");
    expect(draftsSignature([a, b])).not.toBe(draftsSignature([b, a]));
    expect(draftsSignature([a])).not.toBe(draftsSignature([{ ...a, label: "Autre" }]));
    expect(draftsSignature([a])).not.toBe(draftsSignature([{ ...a, quantityText: "x" }]));
  });
  it("est stable après un aller-retour ligne ↔ brouillon", () => {
    const line: QuoteLine = {
      priceItemId: null,
      label: "Divers",
      unit: "h",
      quantity: 2.5,
      unitPriceCents: null,
      source: "ai",
    };
    const draft = draftFromLine(line, "z");
    expect(draftToLine(draft)).toEqual(line);
  });
});

describe("moveItem", () => {
  it("échange avec le voisin sans modifier l'original", () => {
    const original = ["a", "b", "c"];
    expect(moveItem(original, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(original, 1, 1)).toEqual(["a", "c", "b"]);
    expect(original).toEqual(["a", "b", "c"]);
  });
  it("ne bouge pas aux extrémités", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 1)).toEqual(["a", "b"]);
  });
});

describe("filterPriceItems", () => {
  const items = [carrelage, demolition];
  it("filtre sur le libellé, le code, sans casse ni accents", () => {
    expect(filterPriceItems(items, "evacuation")).toEqual([demolition]);
    expect(filterPriceItems(items, "ÉVACUATION")).toEqual([demolition]);
    expect(filterPriceItems(items, "car-0")).toEqual([carrelage]);
    expect(filterPriceItems(items, "pose sol")).toEqual([carrelage]);
    expect(filterPriceItems(items, "zzz")).toEqual([]);
  });
  it("renvoie tout si la requête est vide", () => {
    expect(filterPriceItems(items, "  ")).toEqual(items);
  });
});

describe("groupByCategory", () => {
  it("suit l'ordre des catégories et omet les vides", () => {
    const groups = groupByCategory([carrelage, demolition]);
    expect(groups.map((g) => g.category)).toEqual(["demolition", "carrelage"]);
  });
});
