import "server-only";
import { addQuoteMedia, createQuote, deleteQuote, getQuote, QuoteError } from "@/db/quotes";
import type { Db } from "@/db/create-db";
import { MAX_PHOTOS, type Quote } from "@/domain/types";
import { removeQuoteMediaDir, storeMediaFile } from "./media-store";

/**
 * Crée un devis brouillon à partir de la capture terrain : jusqu'à 3 photos
 * et une note vocale facultative. Tout ou rien : en cas d'erreur, le devis
 * et ses fichiers sont supprimés.
 */
export async function createQuoteFromCapture(
  db: Db,
  input: { photos: Blob[]; audio?: Blob | null; title?: string },
): Promise<Quote> {
  const photos = input.photos.filter((p) => p.size > 0);
  const audio = input.audio && input.audio.size > 0 ? input.audio : null;
  if (photos.length > MAX_PHOTOS) {
    throw new QuoteError(`${MAX_PHOTOS} photos au maximum par devis.`, { photos: `${MAX_PHOTOS} photos au maximum.` });
  }
  if (photos.length === 0 && !audio) {
    throw new QuoteError("Ajoutez au moins une photo ou une note vocale.");
  }

  const quote = createQuote(db, { title: input.title ?? "" });
  try {
    for (const photo of photos) {
      addQuoteMedia(db, quote.id, await storeMediaFile(quote.id, "photo", photo));
    }
    if (audio) {
      addQuoteMedia(db, quote.id, await storeMediaFile(quote.id, "audio", audio));
    }
  } catch (error) {
    await removeQuoteMediaDir(quote.id);
    deleteQuote(db, quote.id);
    throw error;
  }
  return getQuote(db, quote.id)!;
}
