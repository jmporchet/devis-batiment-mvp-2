import "server-only";
import type { Db } from "@/db/create-db";
import { deleteDraftQuote } from "@/db/quotes";
import { removeQuoteMediaDir } from "./media-store";

/**
 * Supprime un brouillon et ses fichiers (photos, note vocale). Refusé pour un
 * devis validé. Renvoie le numéro du devis supprimé.
 */
export async function deleteDraftWithMedia(db: Db, id: number): Promise<string> {
  const number = deleteDraftQuote(db, id);
  await removeQuoteMediaDir(id);
  return number;
}
