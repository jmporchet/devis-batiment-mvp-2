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
import type { Category, Unit } from "@/domain/types";
import type { ActionState } from "./action-state";

const PRICE_ERROR = "Saisissez un montant en francs, par exemple 125 ou 125.50.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function values(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, text(formData, n)]));
}

function failure(error: unknown, submitted: Record<string, string>): ActionState {
  if (error instanceof PriceItemError) {
    // Le formulaire nomme le champ prix « price » ; la validation, « unitPriceCents ».
    const { unitPriceCents, ...rest } = error.fieldErrors;
    const fieldErrors: Record<string, string> = { ...rest };
    if (unitPriceCents) fieldErrors.price = unitPriceCents;
    return { ok: false, message: error.message, fieldErrors, values: submitted, at: Date.now() };
  }
  console.error(error);
  return {
    ok: false,
    message: "Une erreur inattendue est survenue. Réessayez dans un instant.",
    fieldErrors: {},
    values: submitted,
    at: Date.now(),
  };
}

const EDIT_FIELDS = ["label", "unit", "price"];

export async function updatePriceItemAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const submitted = values(formData, EDIT_FIELDS);
  const cents = parseChf(submitted.price);
  if (cents === null) {
    return { ok: false, message: PRICE_ERROR, fieldErrors: { price: PRICE_ERROR }, values: submitted, at: Date.now() };
  }
  try {
    updatePriceItem(getDb(), id, {
      label: submitted.label,
      unit: submitted.unit as Unit,
      unitPriceCents: cents,
    });
  } catch (error) {
    return failure(error, submitted);
  }
  revalidatePath("/grille");
  return { ok: true, message: `Poste ${id} enregistré.`, fieldErrors: {}, at: Date.now() };
}

const CREATE_FIELDS = ["category", "id", "label", "unit", "price"];

export async function createPriceItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const submitted = values(formData, CREATE_FIELDS);
  const cents = parseChf(submitted.price);
  if (cents === null) {
    return { ok: false, message: PRICE_ERROR, fieldErrors: { price: PRICE_ERROR }, values: submitted, at: Date.now() };
  }
  try {
    const item = createPriceItem(getDb(), {
      id: submitted.id.trim().toUpperCase(),
      label: submitted.label,
      unit: submitted.unit as Unit,
      unitPriceCents: cents,
      category: submitted.category as Category,
    });
    revalidatePath("/grille");
    return { ok: true, message: `Poste ${item.id} ajouté.`, fieldErrors: {}, at: Date.now() };
  } catch (error) {
    return failure(error, submitted);
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
