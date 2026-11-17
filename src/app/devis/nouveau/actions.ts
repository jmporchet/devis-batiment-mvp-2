"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { QuoteError } from "@/db/quotes";
import { isAiConfigured } from "@/server/ai/openrouter";
import { createQuoteFromCapture } from "@/server/create-quote";

export interface CaptureState {
  message: string;
  fieldErrors: Record<string, string>;
}

function isBlob(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string";
}

/**
 * Crée le devis brouillon depuis la capture terrain, puis ouvre sa page.
 * Les erreurs métier reviennent à l'écran ; le client garde ses fichiers.
 */
export async function createQuoteAction(
  _prev: CaptureState,
  formData: FormData,
): Promise<CaptureState> {
  const title = formData.get("title");
  const audio = formData.get("audio");

  let id: number;
  try {
    const quote = await createQuoteFromCapture(getDb(), {
      photos: formData.getAll("photos").filter(isBlob),
      audio: isBlob(audio) ? audio : null,
      title: typeof title === "string" ? title : "",
    });
    id = quote.id;
  } catch (error) {
    if (error instanceof QuoteError) {
      return { message: error.message, fieldErrors: error.fieldErrors };
    }
    console.error(error);
    return {
      message: "Une erreur inattendue est survenue. Vos fichiers sont conservés, réessayez dans un instant.",
      fieldErrors: {},
    };
  }
  // redirect() lève une exception de contrôle : hors du try/catch.
  // Avec l'IA configurée, la relecture lance le brouillon automatiquement.
  redirect(isAiConfigured() ? `/devis/${id}?ia=1` : `/devis/${id}`);
}
