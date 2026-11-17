import { describe, expect, it } from "vitest";
import { formatDateCh } from "./format-date";

describe("formatDateCh", () => {
  it("formate en jj.mm.aaaa", () => {
    expect(formatDateCh(new Date("2026-11-17T10:00:00Z"))).toBe("17.11.2026");
  });
  it("garde les zéros initiaux", () => {
    expect(formatDateCh(new Date("2026-03-05T12:00:00Z"))).toBe("05.03.2026");
  });
  it("utilise l'heure de Zurich (minuit local = veille en UTC)", () => {
    expect(formatDateCh(new Date("2026-11-16T23:30:00Z"))).toBe("17.11.2026");
  });
});
