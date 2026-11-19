"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { QuoteError, replaceQuoteLines, setQuoteStatus, updateQuoteInfo } from "@/db/quotes";
import { AiError } from "@/server/ai/openrouter";
import { generateQuoteDraft } from "@/server/ai/generate-draft";
import { deleteDraftWithMedia } from "@/server/delete-quote";
import type { Quote, QuoteInfo, QuoteLine, QuoteStatus } from "@/domain/types";
import type { ActionResult } from "./action-result";

function success(quote: Quote): ActionResult {
  revalidatePath("/devis");
  revalidatePath(`/devis/${quote.id}`);
  const { title, clientName, clientAddress, notes } = quote;
  return {
    ok: true,
    status: quote.status,
    info: { title, clientName, clientAddress, notes },
    lines: quote.lines,
  };
}

function failure(error: unknown): ActionResult {
  if (error instanceof QuoteError) {
    return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof AiError) {
    console.error("IA :", error.message, error.detail ?? "");
    return { ok: false, message: error.message, fieldErrors: {} };
  }
  console.error(error);
  return {
    ok: false,
    message: "Une erreur inattendue est survenue. Vos modifications sont conservées à l'écran, réessayez.",
    fieldErrors: {},
  };
}

function isId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

/** Enregistre l'objet, le client, l'adresse et les notes. */
export async function saveInfoAction(id: number, info: QuoteInfo): Promise<ActionResult> {
  if (!isId(id)) return failure(new QuoteError("Devis introuvable."));
  try {
    return success(
      updateQuoteInfo(getDb(), id, {
        title: info?.title,
        clientName: info?.clientName,
        clientAddress: info?.clientAddress,
        notes: info?.notes,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

/** Remplace toutes les lignes du devis. */
export async function saveLinesAction(id: number, lines: QuoteLine[]): Promise<ActionResult> {
  if (!isId(id)) return failure(new QuoteError("Devis introuvable."));
  if (!Array.isArray(lines)) return failure(new QuoteError("Lignes invalides."));
  try {
    return success(replaceQuoteLines(getDb(), id, lines));
  } catch (error) {
    return failure(error);
  }
}

/** Valide le devis ou le repasse en brouillon. Le serveur applique les règles. */
export async function setStatusAction(id: number, status: QuoteStatus): Promise<ActionResult> {
  if (!isId(id)) return failure(new QuoteError("Devis introuvable."));
  if (status !== "brouillon" && status !== "valide") {
    return failure(new QuoteError("Statut inconnu."));
  }
  try {
    return success(setQuoteStatus(getDb(), id, status));
  } catch (error) {
    return failure(error);
  }
}

/**
 * Demande à l'IA un brouillon de lignes à partir des photos et de la note
 * vocale. Remplace les lignes existantes (l'écran demande confirmation).
 */
export async function generateDraftAction(id: number): Promise<ActionResult> {
  if (!isId(id)) return failure(new QuoteError("Devis introuvable."));
  try {
    const outcome = await generateQuoteDraft(getDb(), id);
    console.info(
      `IA devis ${id} : ${outcome.lineCount} lignes, modèle ${outcome.model}, coût ${outcome.costUsd ?? "?"} $`,
    );
    return success(outcome.quote);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Supprime un brouillon et ses fichiers, puis renvoie vers la liste. Refusé
 * pour un devis validé. Ne renvoie un résultat qu'en cas d'erreur.
 */
export async function deleteDraftAction(id: number): Promise<ActionResult> {
  if (!isId(id)) return failure(new QuoteError("Devis introuvable."));
  let number: string;
  try {
    number = await deleteDraftWithMedia(getDb(), id);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/devis");
  // Hors du try : redirect() fonctionne en levant une exception.
  redirect(`/devis?supprime=${encodeURIComponent(number)}`);
}
