import { beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES } from "@/domain/types";
import { createDb, type Db } from "./create-db";
import {
  CATEGORY_CODE_PREFIX,
  PriceItemError,
  createPriceItem,
  getPriceItem,
  listPriceItems,
  seedPriceGridIfEmpty,
  setPriceItemActive,
  suggestNextCode,
  updatePriceItem,
} from "./price-items";
import { PRICE_GRID_SEED } from "./seed/price-grid";

const valid = {
  id: "DIV-900",
  label: "Poste de test",
  unit: "forfait",
  unitPriceCents: 10_000,
  category: "divers",
} as const;

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
});

describe("grille de départ", () => {
  it("est cohérente : codes uniques, bien formés, préfixe de catégorie, prix entiers", () => {
    const ids = PRICE_GRID_SEED.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of PRICE_GRID_SEED) {
      expect(item.id).toMatch(/^[A-Z]{3}-\d{3}$/);
      expect(item.id.startsWith(`${CATEGORY_CODE_PREFIX[item.category]}-`)).toBe(true);
      expect(Number.isInteger(item.unitPriceCents)).toBe(true);
      expect(item.unitPriceCents).toBeGreaterThan(0);
    }
  });

  it("est insérée une seule fois (idempotent)", () => {
    expect(seedPriceGridIfEmpty(db)).toBe(PRICE_GRID_SEED.length);
    expect(seedPriceGridIfEmpty(db)).toBe(0);
    expect(listPriceItems(db)).toHaveLength(PRICE_GRID_SEED.length);
  });

  it("ne touche pas à une table déjà remplie", () => {
    createPriceItem(db, valid);
    expect(seedPriceGridIfEmpty(db)).toBe(0);
    expect(listPriceItems(db)).toHaveLength(1);
  });
});

describe("CRUD", () => {
  it("crée puis relit un poste, actif par défaut", () => {
    const created = createPriceItem(db, valid);
    expect(created).toEqual({ ...valid, active: true });
    expect(getPriceItem(db, "DIV-900")).toEqual(created);
    expect(getPriceItem(db, "DIV-901")).toBeUndefined();
  });

  it("modifie libellé, unité et prix sans changer le code", () => {
    createPriceItem(db, valid);
    const updated = updatePriceItem(db, "DIV-900", {
      label: "  Nouveau libellé ",
      unit: "h",
      unitPriceCents: 9_500,
    });
    expect(updated).toMatchObject({
      id: "DIV-900",
      label: "Nouveau libellé",
      unit: "h",
      unitPriceCents: 9_500,
      category: "divers",
    });
  });

  it("désactive et réactive sans supprimer", () => {
    createPriceItem(db, valid);
    expect(setPriceItemActive(db, "DIV-900", false).active).toBe(false);
    expect(getPriceItem(db, "DIV-900")?.active).toBe(false);
    expect(setPriceItemActive(db, "DIV-900", true).active).toBe(true);
  });

  it("masque les postes inactifs sauf demande explicite", () => {
    createPriceItem(db, valid);
    createPriceItem(db, { ...valid, id: "DIV-910" });
    setPriceItemActive(db, "DIV-910", false);
    expect(listPriceItems(db).map((i) => i.id)).toEqual(["DIV-900"]);
    expect(listPriceItems(db, { includeInactive: true }).map((i) => i.id)).toEqual([
      "DIV-900",
      "DIV-910",
    ]);
  });

  it("signale un poste introuvable", () => {
    expect(() => updatePriceItem(db, "DIV-999", { label: "x" })).toThrow("Poste introuvable.");
    expect(() => setPriceItemActive(db, "DIV-999", false)).toThrow("Poste introuvable.");
  });
});

describe("validations", () => {
  it.each([
    ["code mal formé", { id: "div-900" }, "id"],
    ["code sans tiret", { id: "DIV900" }, "id"],
    ["code trop court", { id: "DIV-90" }, "id"],
    ["libellé vide", { label: "   " }, "label"],
    ["unité inconnue", { unit: "kg" }, "unit"],
    ["catégorie inconnue", { category: "toiture" }, "category"],
    ["prix négatif", { unitPriceCents: -1 }, "unitPriceCents"],
    ["prix non entier", { unitPriceCents: 10.5 }, "unitPriceCents"],
    ["prix NaN", { unitPriceCents: Number.NaN }, "unitPriceCents"],
  ])("refuse à la création : %s", (_nom, override, field) => {
    let error: unknown;
    try {
      createPriceItem(db, { ...valid, ...override } as never);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(PriceItemError);
    expect((error as PriceItemError).fieldErrors[field as "id"]).toBeTruthy();
    expect(listPriceItems(db, { includeInactive: true })).toHaveLength(0);
  });

  it("accepte un prix à zéro", () => {
    expect(createPriceItem(db, { ...valid, unitPriceCents: 0 }).unitPriceCents).toBe(0);
  });

  it("refuse un code déjà utilisé, y compris par un poste inactif", () => {
    createPriceItem(db, valid);
    setPriceItemActive(db, "DIV-900", false);
    expect(() => createPriceItem(db, valid)).toThrow("existe déjà");
  });

  it("refuse une modification invalide et laisse le poste intact", () => {
    createPriceItem(db, valid);
    expect(() => updatePriceItem(db, "DIV-900", { unitPriceCents: -5 })).toThrow(PriceItemError);
    expect(() => updatePriceItem(db, "DIV-900", { unit: "kg" as never })).toThrow(PriceItemError);
    expect(getPriceItem(db, "DIV-900")).toEqual({ ...valid, active: true });
  });
});

describe("tri et codes suggérés", () => {
  it("trie par catégorie (ordre du domaine) puis par code", () => {
    createPriceItem(db, { ...valid, id: "DIV-020" });
    createPriceItem(db, { ...valid, id: "SAN-020", category: "sanitaire" });
    createPriceItem(db, { ...valid, id: "DEM-030", category: "demolition" });
    createPriceItem(db, { ...valid, id: "SAN-010", category: "sanitaire" });
    createPriceItem(db, { ...valid, id: "DIV-010" });
    expect(listPriceItems(db).map((i) => i.id)).toEqual([
      "DEM-030",
      "SAN-010",
      "SAN-020",
      "DIV-010",
      "DIV-020",
    ]);
  });

  it("trie la grille de départ complète dans l'ordre des catégories", () => {
    seedPriceGridIfEmpty(db);
    const cats = listPriceItems(db).map((i) => CATEGORIES.indexOf(i.category));
    expect(cats).toEqual([...cats].sort((a, b) => a - b));
  });

  it("propose le prochain numéro libre de la catégorie", () => {
    expect(suggestNextCode(db, "carrelage")).toBe("CAR-010");
    seedPriceGridIfEmpty(db);
    expect(suggestNextCode(db, "carrelage")).toBe("CAR-080");
    expect(suggestNextCode(db, "divers")).toBe("DIV-050");
    createPriceItem(db, { ...valid, id: "MEN-045", category: "menuiserie" });
    expect(suggestNextCode(db, "menuiserie")).toBe("MEN-050");
  });

  it("reste valide pour toutes les catégories", () => {
    for (const category of CATEGORIES) {
      expect(suggestNextCode(db, category)).toMatch(/^[A-Z]{3}-\d{3}$/);
    }
  });
});
