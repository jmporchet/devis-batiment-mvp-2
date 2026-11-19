"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { MAX_LOGO_BYTES, setCompanyLogo, updateCompany } from "@/db/company";
import { QuoteError } from "@/db/quotes";
import { FIELDS, type CompanyFormState, type FieldName, type LogoState } from "./action-state";

const UNEXPECTED = "Une erreur inattendue est survenue. Réessayez dans un instant.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, text(formData, f)])) as Record<FieldName, string>;
  const rawDays = values.validityDays.trim();
  // Nombre entier strict : « 30 jours » ou « 1.5 » sont refusés, pas tronqués.
  const validityDays = /^\d+$/.test(rawDays) ? Number(rawDays) : Number.NaN;

  try {
    updateCompany(getDb(), { ...values, validityDays });
  } catch (error) {
    if (error instanceof QuoteError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors, values };
    }
    console.error(error);
    return { ok: false, message: UNEXPECTED, fieldErrors: {}, values };
  }
  revalidatePath("/entreprise");
  return { ok: true, message: "Coordonnées enregistrées.", fieldErrors: {}, values };
}

async function uploadLogo(formData: FormData): Promise<LogoState> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choisissez d'abord un fichier PNG ou JPEG." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, message: "Le logo dépasse 1 Mo. Choisissez une image plus légère." };
  }
  try {
    setCompanyLogo(getDb(), Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof QuoteError) return { ok: false, message: error.message };
    console.error(error);
    return { ok: false, message: UNEXPECTED };
  }
  revalidatePath("/entreprise");
  return { ok: true, message: "Logo enregistré." };
}

async function removeLogo(): Promise<LogoState> {
  try {
    setCompanyLogo(getDb(), null);
  } catch (error) {
    console.error(error);
    return { ok: false, message: UNEXPECTED };
  }
  revalidatePath("/entreprise");
  return { ok: true, message: "Logo retiré." };
}

/** Envoi (par défaut) ou retrait (`intent=remove`) du logo, avec un seul état de message. */
export async function logoAction(_prev: LogoState, formData: FormData): Promise<LogoState> {
  return text(formData, "intent") === "remove" ? removeLogo() : uploadLogo(formData);
}
