import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/create-db";
import { seedPriceGridIfEmpty } from "@/db/price-items";
import { createQuote, getQuote, replaceQuoteLines, setQuoteStatus } from "@/db/quotes";
import { createQuoteFromCapture } from "../create-quote";
import { generateQuoteDraft } from "./generate-draft";
import type { FetchLike } from "./openrouter";

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new Array(60).fill(0)]);
const env = { OPENROUTER_API_KEY: "test-key" } as unknown as NodeJS.ProcessEnv;

function fakeFetch(content: unknown, status = 200): { fetch: FetchLike; calls: { url: string; body: unknown; auth: string }[] } {
  const calls: { url: string; body: unknown; auth: string }[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({
        url,
        body: JSON.parse(String(init.body)),
        auth: (init.headers as Record<string, string>).Authorization,
      });
      const payload =
        status === 200
          ? { model: "google/test", usage: { cost: 0.01 }, choices: [{ message: { content: JSON.stringify(content) } }] }
          : { error: { message: "nope" } };
      return new Response(JSON.stringify(payload), { status });
    },
  };
}

let db: Db;
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-"));
  process.env.MEDIA_DIR = dir;
  db = createDb(":memory:");
  seedPriceGridIfEmpty(db);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDIA_DIR;
});

const capture = () => createQuoteFromCapture(db, { photos: [], audio: new Blob([WEBM]) });

describe("generateQuoteDraft", () => {
  it("enregistre les lignes IA, la transcription et l'objet", async () => {
    const quote = await capture();
    const { fetch, calls } = fakeFetch({
      transcription: "Salle de bain six mètres carrés, carrelage à refaire.",
      titre: "Rénovation salle de bain",
      lignes: [
        { code: "DEM-010", libelle: "", unite: "m2", quantite: 6 },
        { code: "CAR-010", libelle: "", unite: "m2", quantite: 6 },
        { code: null, libelle: "Niche murale", unite: "pce", quantite: 1 },
      ],
      hypotheses: ["DEM-010 : démolition déduite du carrelage à refaire."],
    });

    const out = await generateQuoteDraft(db, quote.id, { env, fetch });

    expect(calls[0].auth).toBe("Bearer test-key");
    expect(calls[0].body).toMatchObject({
      model: "google/gemini-3.8-flash",
      temperature: 0.2,
      provider: { data_collection: "deny", zdr: true },
    });
    expect(out).toMatchObject({ model: "google/test", costUsd: 0.01, lineCount: 3 });
    const saved = getQuote(db, quote.id)!;
    expect(saved.title).toBe("Rénovation salle de bain");
    expect(saved.lines.map((l) => [l.priceItemId, l.quantity, l.unitPriceCents, l.source])).toEqual([
      ["DEM-010", 6, 4_800, "ai"],
      ["CAR-010", 6, 13_500, "ai"],
      [null, 1, null, "ai"],
    ]);
    expect(saved.notes).toContain("Salle de bain six mètres carrés");
    expect(saved.notes).toContain("- DEM-010 : démolition déduite");
  });

  it("ne remplace pas un objet déjà saisi et suit OPENROUTER_MODEL", async () => {
    const quote = await createQuoteFromCapture(db, { photos: [], audio: new Blob([WEBM]), title: "Chez Mme Rochat" });
    const { fetch, calls } = fakeFetch({ transcription: "", titre: "Autre", lignes: [{ code: "CAR-010", libelle: "", unite: "m2", quantite: 2 }], hypotheses: [] });
    await generateQuoteDraft(db, quote.id, { env: { ...env, OPENROUTER_MODEL: "x/y" }, fetch });
    expect(calls[0].body).toMatchObject({ model: "x/y" });
    expect(getQuote(db, quote.id)!.title).toBe("Chez Mme Rochat");
  });

  it("refuse sans clé, sans média ou sur un devis validé, sans appeler l'API", async () => {
    const { fetch, calls } = fakeFetch({});
    const quote = await capture();
    await expect(generateQuoteDraft(db, quote.id, { env: {} as NodeJS.ProcessEnv, fetch })).rejects.toThrow(/OPENROUTER_API_KEY/);
    const empty = createQuote(db);
    await expect(generateQuoteDraft(db, empty.id, { env, fetch })).rejects.toThrow(/ni photo ni note vocale/);
    replaceQuoteLines(db, quote.id, [{ priceItemId: "CAR-010", label: "x", unit: "m2", quantity: 1, unitPriceCents: 100, source: "manual" }]);
    setQuoteStatus(db, quote.id, "valide");
    await expect(generateQuoteDraft(db, quote.id, { env, fetch })).rejects.toThrow(/validé/);
    expect(calls).toHaveLength(0);
  });

  it("traduit les erreurs HTTP et laisse les lignes intactes", async () => {
    const quote = await capture();
    replaceQuoteLines(db, quote.id, [{ priceItemId: "CAR-010", label: "x", unit: "m2", quantity: 1, unitPriceCents: 100, source: "manual" }]);
    await expect(generateQuoteDraft(db, quote.id, { env, fetch: fakeFetch({}, 402).fetch })).rejects.toThrow(/Crédit OpenRouter épuisé/);
    await expect(generateQuoteDraft(db, quote.id, { env, fetch: fakeFetch({}, 401).fetch })).rejects.toThrow(/Clé OpenRouter refusée/);
    await expect(
      generateQuoteDraft(db, quote.id, { env, fetch: fakeFetch({ transcription: "", titre: "", lignes: [], hypotheses: [] }).fetch }),
    ).rejects.toThrow(/aucune ligne/);
    expect(getQuote(db, quote.id)!.lines).toHaveLength(1);
  });
});
