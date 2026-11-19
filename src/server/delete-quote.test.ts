import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/create-db";
import { seedPriceGridIfEmpty } from "@/db/price-items";
import { getQuote, listQuotes, replaceQuoteLines, setQuoteStatus } from "@/db/quotes";
import { createQuoteFromCapture } from "./create-quote";
import { deleteDraftWithMedia } from "./delete-quote";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(0)]);

let db: Db;
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "delete-"));
  process.env.MEDIA_DIR = dir;
  db = createDb(":memory:");
  seedPriceGridIfEmpty(db);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDIA_DIR;
});

describe("deleteDraftWithMedia", () => {
  it("supprime le brouillon, ses lignes, ses médias et ses fichiers", async () => {
    const keep = await createQuoteFromCapture(db, { photos: [new Blob([JPEG])] });
    const quote = await createQuoteFromCapture(db, { photos: [new Blob([JPEG]), new Blob([JPEG])] });
    replaceQuoteLines(db, quote.id, [
      { priceItemId: "CAR-010", label: "x", unit: "m2", quantity: 2, unitPriceCents: 100, source: "manual" },
    ]);
    expect(fs.readdirSync(path.join(dir, String(quote.id)))).toHaveLength(2);

    await expect(deleteDraftWithMedia(db, quote.id)).resolves.toBe(quote.number);

    expect(getQuote(db, quote.id)).toBeUndefined();
    expect(fs.existsSync(path.join(dir, String(quote.id)))).toBe(false);
    expect(listQuotes(db).map((q) => q.id)).toEqual([keep.id]);
    expect(fs.readdirSync(path.join(dir, String(keep.id)))).toHaveLength(1);
  });

  it("refuse un devis validé et ne touche à rien", async () => {
    const quote = await createQuoteFromCapture(db, { photos: [new Blob([JPEG])] });
    replaceQuoteLines(db, quote.id, [
      { priceItemId: "CAR-010", label: "x", unit: "m2", quantity: 2, unitPriceCents: 100, source: "manual" },
    ]);
    setQuoteStatus(db, quote.id, "valide");
    await expect(deleteDraftWithMedia(db, quote.id)).rejects.toThrow(/validé ne peut pas être supprimé/);
    expect(getQuote(db, quote.id)).toBeDefined();
    expect(fs.readdirSync(path.join(dir, String(quote.id)))).toHaveLength(1);
  });

  it("signale un devis introuvable", async () => {
    await expect(deleteDraftWithMedia(db, 999)).rejects.toThrow(/introuvable/);
  });
});
