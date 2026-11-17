"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { QuoteError, replaceQuoteLines, setQuoteStatus, updateQuoteInfo } from "@/db/quotes";
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
