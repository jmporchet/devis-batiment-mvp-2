import { describe, expect, it } from "vitest";
import { createDb } from "./create-db";
import { priceItems } from "./schema";

describe("createDb", () => {
  it("applique les migrations et permet d'écrire puis lire un poste", () => {
    const db = createDb(":memory:");
    db.insert(priceItems)
      .values({
        id: "TEST-001",
        label: "Poste de test",
        unit: "m2",
        unitPriceCents: 12_500,
        category: "divers",
      })
      .run();

    const rows = db.select().from(priceItems).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "TEST-001",
      unitPriceCents: 12_500,
      active: true,
    });
  });
});
