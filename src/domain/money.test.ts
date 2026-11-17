import { describe, expect, it } from "vitest";
import { formatAmount, formatChf, parseChf } from "./money";

describe("formatAmount", () => {
  it.each([
    [0, "0.00"],
    [5, "0.05"],
    [12_550, "125.50"],
    [123_450, "1'234.50"],
    [123_456_789, "1'234'567.89"],
    [-12_550, "-125.50"],
  ])("%i → %s", (cents, expected) => {
    expect(formatAmount(cents)).toBe(expected);
  });

  it("refuse un montant non entier", () => {
    expect(() => formatAmount(12.5)).toThrow();
  });
});

describe("formatChf", () => {
  it("préfixe CHF", () => {
    expect(formatChf(123_450)).toBe("CHF 1'234.50");
  });
});

describe("parseChf", () => {
  it.each([
    ["125", 12_500],
    ["125.5", 12_550],
    ["125,50", 12_550],
    ["1'250.00", 125_000],
    ["CHF 1'250", 125_000],
    [" 0.05 ", 5],
    ["-10", -1_000],
  ])("%s → %i", (input, expected) => {
    expect(parseChf(input)).toBe(expected);
  });

  it.each(["", "abc", "12.345", "1.2.3", "12,5,0"])("refuse %s", (input) => {
    expect(parseChf(input)).toBeNull();
  });
});
