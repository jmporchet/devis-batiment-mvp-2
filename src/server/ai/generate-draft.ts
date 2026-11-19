import "server-only";
import fs from "node:fs/promises";
import type { Db } from "@/db/create-db";
import { listPriceItems } from "@/db/price-items";
import { getQuote, getQuoteMediaFile, QuoteError, replaceQuoteLines, updateQuoteInfo } from "@/db/quotes";
import type { Quote } from "@/domain/types";
import { mediaFilePath } from "../media-store";
import { buildDraftMessages, DRAFT_RESPONSE_FORMAT, mergeNotes, parseDraftResponse, type DraftMedia } from "./draft";
import { aiConfig, AiError, chatCompletion, PRIVATE_ROUTING, type FetchLike } from "./openrouter";

export interface DraftOutcome {
  quote: Quote;
  model: string;
  costUsd: number | null;
  lineCount: number;
}

/**
 * Génère le brouillon IA d'un devis et l'enregistre : les lignes sont
 * remplacées (source « ai »), la transcription et les points à vérifier vont
 * dans les notes, l'objet est rempli s'il était vide.
 */
export async function generateQuoteDraft(
  db: Db,
  quoteId: number,
  deps: { env?: NodeJS.ProcessEnv; fetch?: FetchLike } = {},
): Promise<DraftOutcome> {
  const { apiKey, model } = aiConfig(deps.env);
  if (!apiKey) {
    throw new AiError("L'IA n'est pas configurée : ajoutez OPENROUTER_API_KEY dans .env.local puis redémarrez le serveur.");
  }
  const quote = getQuote(db, quoteId);
  if (!quote) throw new QuoteError("Devis introuvable.");
  if (quote.status === "valide") {
    throw new QuoteError("Ce devis est validé. Repassez-le en brouillon pour relancer l'IA.");
  }
  if (quote.media.length === 0) {
    throw new QuoteError("Ce devis n'a ni photo ni note vocale à analyser.");
  }

  const media: DraftMedia[] = [];
  for (const m of quote.media) {
    const file = getQuoteMediaFile(db, quoteId, m.id);
    if (!file) continue;
    try {
      const bytes = await fs.readFile(mediaFilePath(quoteId, file.fileName));
      media.push({ kind: m.kind, mimeType: m.mimeType, base64: bytes.toString("base64") });
    } catch {
      // Fichier manquant sur disque : on analyse le reste.
    }
  }
  if (media.length === 0) throw new QuoteError("Les fichiers de ce devis sont introuvables sur le serveur.");

  const priceItems = listPriceItems(db);
  const result = await chatCompletion(
    {
      model,
      messages: buildDraftMessages({ title: quote.title, notes: quote.notes, priceItems, media }),
      response_format: DRAFT_RESPONSE_FORMAT,
      temperature: 0.2,
      provider: PRIVATE_ROUTING,
    },
    { apiKey, fetch: deps.fetch },
  );

  let draft;
  try {
    draft = parseDraftResponse(result.content, priceItems);
  } catch (error) {
    throw new AiError("La réponse de l'IA est inexploitable. Relancez l'analyse.", String(error));
  }
  if (draft.lines.length === 0) {
    throw new AiError("L'IA n'a proposé aucune ligne. Complétez le devis à la main ou relancez l'analyse.");
  }

  replaceQuoteLines(db, quoteId, draft.lines);
  updateQuoteInfo(db, quoteId, {
    notes: mergeNotes(quote.notes, draft),
    ...(quote.title.trim() ? {} : { title: draft.title }),
  });

  return {
    quote: getQuote(db, quoteId)!,
    model: result.model,
    costUsd: typeof result.usage.cost === "number" ? result.usage.cost : null,
    lineCount: draft.lines.length,
  };
}
