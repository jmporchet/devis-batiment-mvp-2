/**
 * Essai réel du brouillon IA, hors application :
 *   OPENROUTER_API_KEY=… npm run ai:smoke -- note.webm [photo.jpg …]
 * Crée un devis dans une base temporaire, appelle l'IA, affiche les lignes,
 * les totaux et le coût. Ne touche pas à data/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "../src/db/create-db";
import { seedPriceGridIfEmpty } from "../src/db/price-items";
import { formatChf } from "../src/domain/money";
import { computeTotals } from "../src/domain/pricing";
import { createQuoteFromCapture } from "../src/server/create-quote";
import { generateQuoteDraft } from "../src/server/ai/generate-draft";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage : npm run ai:smoke -- note.webm [photo.jpg …]");
    process.exit(1);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ai-smoke-"));
  process.env.MEDIA_DIR = tmp;
  const db = createDb(":memory:");
  seedPriceGridIfEmpty(db);
  const blob = (f: string) => new Blob([new Uint8Array(fs.readFileSync(f))]);
  const audio = files.find((f) => /\.(webm|ogg|m4a|mp3|wav)$/i.test(f));
  const photos = files.filter((f) => f !== audio);
  const quote = await createQuoteFromCapture(db, { photos: photos.map(blob), audio: audio ? blob(audio) : null });

  const t0 = Date.now();
  const out = await generateQuoteDraft(db, quote.id);
  const q = out.quote;
  console.log(`Modèle : ${out.model} · ${((Date.now() - t0) / 1000).toFixed(1)} s · coût ${out.costUsd ?? "?"} $`);
  console.log(`Objet : ${q.title}\n`);
  for (const l of q.lines) {
    console.log(`${(l.priceItemId ?? "HORS GRILLE").padEnd(11)} ${String(l.quantity).padStart(6)} ${l.unit.padEnd(7)} ${l.unitPriceCents === null ? "à chiffrer" : formatChf(l.unitPriceCents).padStart(13)}  ${l.label}`);
  }
  const t = computeTotals(q.lines);
  console.log(`\nHT ${formatChf(t.subtotalCents)} · TVA ${formatChf(t.vatCents)} · TTC ${formatChf(t.totalCents)}${t.hasUnpricedLines ? " (incomplet)" : ""}`);
  console.log(`\nNotes :\n${q.notes}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e.message, e.detail ?? "");
  process.exit(1);
});
