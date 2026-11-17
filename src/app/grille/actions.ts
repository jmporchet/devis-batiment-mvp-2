"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import {
  PriceItemError,
  createPriceItem,
  setPriceItemActive,
  updatePriceItem,
} from "@/db/price-items";
import { parseChf } from "@/domain/money";
import type { ActionState } from "./action-state";

const PRICE_ERROR =
  "Prix invalide. Saisissez un montant en francs, par exemple 125 ou 125.50.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failure(error: unknown): ActionState {
  if (error instanceof PriceItemError) {
    return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  console.error(error);
  return {
    ok: false,
    message: "Une erreur inattendue est survenue. Réessayez dans un instant.",
    fieldErrors: {},
  };
}

export async function updatePriceItemAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const cents = parseChf(text(formData, "price"));
  if (cents === null) {
    return { ok: false, message: PRICE_ERROR, fieldErrors: { unitPriceCents: PRICE_ERROR } };
  }
  try {
    updatePriceItem(getDb(), id, {
      label: text(formData, "label"),
      unit: text(formData, "unit") as never,
      unitPriceCents: cents,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/grille");
  return { ok: true, message: "Poste enregistré.", fieldErrors: {} };
}

export async function createPriceItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const cents = parseChf(text(formData, "price"));
  if (cents === null) {
    return { ok: false, message: PRICE_ERROR, fieldErrors: { unitPriceCents: PRICE_ERROR } };
  }
  try {
    const item = createPriceItem(getDb(), {
      id: text(formData, "id").toUpperCase(),
      label: text(formData, "label"),
      unit: text(formData, "unit") as never,
      unitPriceCents: cents,
      category: text(formData, "category") as never,
    });
    revalidatePath("/grille");
    return { ok: true, message: `Poste ${item.id} ajouté.`, fieldErrors: {} };
  } catch (error) {
    return failure(error);
  }
}

/** Active ou désactive un poste. Reçoit l'identifiant et l'état voulu via `bind`. */
export async function setPriceItemActiveAction(id: string, active: boolean): Promise<void> {
  try {
    setPriceItemActive(getDb(), id, active);
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath("/grille");
}
