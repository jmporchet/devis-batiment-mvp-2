import { describe, expect, it } from "vitest";
import { computeTotals, lineTotalCents, roundTo5Cents, vatCents } from "./pricing";
import type { QuoteLine } from "./types";

function line(quantity: number, unitPriceCents: number | null, label = "Poste"): QuoteLine {
  return { priceItemId: null, label, unit: "pce", quantity, unitPriceCents, source: "manual" };
}

describe("lineTotalCents", () => {
  it("renvoie null pour une ligne à chiffrer", () => {
    expect(lineTotalCents(line(3, null))).toBeNull();
  });

  it("multiplie quantité entière et prix", () => {
    expect(lineTotalCents(line(3, 1250))).toBe(3750);
    expect(lineTotalCents(line(0, 1250))).toBe(0);
  });

  it("gère les quantités décimales", () => {
    expect(lineTotalCents(line(6.5, 8500))).toBe(55250); // 6.5 m² x 85.00
    expect(lineTotalCents(line(0.33, 9500))).toBe(3135); // 0.33 h x 95.00 = 31.35
    expect(lineTotalCents(line(12.25, 4590))).toBe(56228); // 562.275 -> 562.28
  });

  it("évite les pièges du float", () => {
    expect(lineTotalCents(line(0.1, 3))).toBe(0); // 0.3 ct -> 0
    expect(lineTotalCents(line(3, 10))).toBe(30);
    expect(lineTotalCents(line(0.1 * 3, 1000))).toBe(300); // 0.30000000000000004
    expect(lineTotalCents(line(1.15, 10000))).toBe(11500);
    expect(lineTotalCents(line(1.15, 100))).toBe(115); // 1.15 x 100 = 114.999... en float
  });

  it("arrondit à la moitié supérieure en valeur absolue", () => {
    expect(lineTotalCents(line(0.5, 1))).toBe(1); // 0.5 -> 1
    expect(lineTotalCents(line(0.01, 49))).toBe(0); // 0.49 -> 0
    expect(lineTotalCents(line(0.01, 50))).toBe(1); // 0.50 -> 1
    expect(lineTotalCents(line(0.15, 10))).toBe(2); // 1.5 -> 2
    expect(lineTotalCents(line(8.25, 9850))).toBe(81263); // 81262.5 -> 81263
  });

  it("est symétrique pour les négatifs (remises)", () => {
    expect(lineTotalCents(line(-0.5, 1))).toBe(-1);
    expect(lineTotalCents(line(-8.25, 9850))).toBe(-81263);
    expect(lineTotalCents(line(1, -1250))).toBe(-1250);
    expect(lineTotalCents(line(-0.01, 49))).toBe(0);
  });

  it("ne renvoie jamais -0", () => {
    expect(Object.is(lineTotalCents(line(-0.01, 49)), 0)).toBe(true);
  });

  it("lève une erreur pour une quantité invalide", () => {
    expect(() => lineTotalCents(line(Number.NaN, 100))).toThrow();
    expect(() => lineTotalCents(line(Infinity, 100))).toThrow();
    expect(() => lineTotalCents(line(1.234, 100))).toThrow(/2 décimales/);
    expect(() => lineTotalCents(line(0.001, 100))).toThrow();
  });

  it("lève une erreur pour un prix non entier", () => {
    expect(() => lineTotalCents(line(1, 12.5))).toThrow();
    expect(() => lineTotalCents(line(1, Number.NaN))).toThrow();
  });

  it("valide la quantité même pour une ligne à chiffrer", () => {
    expect(() => lineTotalCents(line(Number.NaN, null))).toThrow();
  });
});

describe("roundTo5Cents", () => {
  it.each([
    [1250, 1250],
    [1251, 1250],
    [1252, 1250],
    [1253, 1255],
    [1254, 1255],
    [1255, 1255],
    [1256, 1255],
    [1257, 1255],
    [1258, 1260],
    [1259, 1260],
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 5],
    [4, 5],
  ])("%i -> %i", (input, expected) => {
    expect(roundTo5Cents(input)).toBe(expected);
  });

  it("est symétrique pour les négatifs", () => {
    expect(roundTo5Cents(-1252)).toBe(-1250);
    expect(roundTo5Cents(-1253)).toBe(-1255);
    expect(roundTo5Cents(-1257)).toBe(-1255);
    expect(roundTo5Cents(-1258)).toBe(-1260);
    expect(Object.is(roundTo5Cents(-2), 0)).toBe(true);
  });

  it("refuse un montant non entier", () => {
    expect(() => roundTo5Cents(12.5)).toThrow();
  });
});

describe("vatCents", () => {
  it("calcule la TVA à 8,1 %", () => {
    expect(vatCents(10000, 810)).toBe(810);
    expect(vatCents(0, 810)).toBe(0);
    expect(vatCents(588203, 810)).toBe(47644); // 47644.443
  });

  it("arrondit la moitié vers le haut", () => {
    expect(vatCents(50, 1000)).toBe(5);
    expect(vatCents(5, 1000)).toBe(1); // 0.5 -> 1
    expect(vatCents(4, 1000)).toBe(0); // 0.4 -> 0
    expect(vatCents(-5, 1000)).toBe(-1);
  });

  it("gère un taux nul", () => {
    expect(vatCents(12345, 0)).toBe(0);
  });

  it("refuse les entrées non entières", () => {
    expect(() => vatCents(10.5, 810)).toThrow();
    expect(() => vatCents(1000, 8.1)).toThrow();
  });
});

describe("computeTotals", () => {
  it("renvoie des zéros pour une liste vide", () => {
    expect(computeTotals([])).toEqual({
      subtotalCents: 0,
      vatRateBp: 810,
      vatCents: 0,
      roundingCents: 0,
      totalCents: 0,
      hasUnpricedLines: false,
    });
  });

  it("calcule la TVA sur le sous-total, pas ligne par ligne", () => {
    // 3 x 0.05 CHF : TVA par ligne = 3 x 0 ; sur le sous-total = 12 ct x 8.1 % = 1 ct (0.972)
    const lines = [line(1, 5), line(1, 5), line(1, 5)];
    const t = computeTotals(lines);
    expect(t.subtotalCents).toBe(15);
    expect(t.vatCents).toBe(1);
  });

  it("ignore les lignes à chiffrer et les signale", () => {
    const t = computeTotals([line(2, 10000), line(1, null)]);
    expect(t.subtotalCents).toBe(20000);
    expect(t.hasUnpricedLines).toBe(true);
    expect(t.vatCents).toBe(1620);
    expect(t.totalCents).toBe(21620);
    expect(t.roundingCents).toBe(0);
  });

  it("une liste uniquement à chiffrer donne des zéros et le drapeau", () => {
    const t = computeTotals([line(1, null)]);
    expect(t.subtotalCents).toBe(0);
    expect(t.totalCents).toBe(0);
    expect(t.hasUnpricedLines).toBe(true);
  });

  it("arrondit le TTC aux 5 ct et expose l'écart", () => {
    // 100.00 + 8.1 % = 108.10 : déjà sur un multiple de 5
    expect(computeTotals([line(1, 10000)]).roundingCents).toBe(0);
    // 10.10 + 0.82 (0.8181) = 10.92 -> 10.90, écart -2
    const down = computeTotals([line(1, 1010)]);
    expect(down.vatCents).toBe(82);
    expect(down.totalCents).toBe(1090);
    expect(down.roundingCents).toBe(-2);
    // 10.30 + 0.83 (0.8343) = 11.13 -> 11.15, écart +2
    const up = computeTotals([line(1, 1030)]);
    expect(up.vatCents).toBe(83);
    expect(up.totalCents).toBe(1115);
    expect(up.roundingCents).toBe(2);
  });

  it("respecte un autre taux de TVA", () => {
    const t = computeTotals([line(1, 10000)], 260);
    expect(t.vatRateBp).toBe(260);
    expect(t.vatCents).toBe(260);
    expect(t.totalCents).toBe(10260);
  });

  it("propage les erreurs de ligne", () => {
    expect(() => computeTotals([line(1.234, 100)])).toThrow();
  });

  it("salle de bain de 6 m2 : total TTC vérifié à la main", () => {
    /*
     * Lignes (centimes) :
     *  1. Dépose et évacuation, 1 forfait x 1'200.00            = 120000
     *  2. Chape, 6 m2 x 85.00                                   =  51000
     *  3. Carrelage sol, 6 m2 x 140.00                          =  84000
     *  4. Faïence murale, 15.5 m2 x 150.00 = 2325.00            = 232500
     *  5. Pose sanitaires, 8.25 h x 98.50 = 812.625 -> 812.63   =  81263
     *  6. Peinture plafond, 6 m2 x 32.40                        =  19440
     * Sous-total HT : 120000+51000+84000+232500+81263+19440     = 588203
     * TVA 8,1 % : 588203 x 0.081 = 47644.443 -> 47644
     * HT + TVA : 635847 -> reste 2 sur 5, arrondi vers le bas -> 635845
     * Ecart d'arrondi : -2. Total TTC : CHF 6'358.45.
     */
    const lines: QuoteLine[] = [
      line(1, 120000, "Dépose et évacuation"),
      line(6, 8500, "Chape"),
      line(6, 14000, "Carrelage sol"),
      line(15.5, 15000, "Faïence murale"),
      line(8.25, 9850, "Pose sanitaires"),
      line(6, 3240, "Peinture plafond"),
    ];
    expect(computeTotals(lines)).toEqual({
      subtotalCents: 588203,
      vatRateBp: 810,
      vatCents: 47644,
      roundingCents: -2,
      totalCents: 635845,
      hasUnpricedLines: false,
    });
  });
});
