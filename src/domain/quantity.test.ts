import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantity } from "./quantity";

describe("parseQuantity", () => {
  it.each([
    ["6,5", 6.5],
    ["6.5", 6.5],
    ["0.33", 0.33],
    ["0,05", 0.05],
    ["12", 12],
    ["1'000", 1000],
    ["1’000.25", 1000.25],
    [" 3 ", 3],
    ["-1", -1],
    ["-2,5", -2.5],
    ["0", 0],
    ["-0", 0],
    ["1.10", 1.1],
  ])("accepte %j", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it.each(["", "  ", "abc", "1.234", "1,234", "12x", "--1", "+1", ".5", "5.", "1,2,3", "1.2.3", "NaN", "1e3"])(
    "refuse %j",
    (input) => {
      expect(parseQuantity(input)).toBeNull();
    },
  );

  it("refuse un nombre hors de la plage sûre", () => {
    expect(parseQuantity("9".repeat(30))).toBeNull();
  });

  it("ne renvoie jamais -0", () => {
    expect(Object.is(parseQuantity("-0.00"), 0)).toBe(true);
  });
});

describe("formatQuantity", () => {
  it.each([
    [6.5, "6.5"],
    [1, "1"],
    [0.33, "0.33"],
    [12.3, "12.3"],
    [1000.25, "1000.25"],
    [-1, "-1"],
    [-2.5, "-2.5"],
    [0, "0"],
    [1.15, "1.15"],
  ])("%j → %j", (n, expected) => {
    expect(formatQuantity(n)).toBe(expected);
  });

  it("est l'inverse de parseQuantity", () => {
    for (const n of [0.01, 0.1, 1.15, 6.5, 99.99, -3.07, 1000]) {
      expect(parseQuantity(formatQuantity(n))).toBe(n);
    }
  });
});
