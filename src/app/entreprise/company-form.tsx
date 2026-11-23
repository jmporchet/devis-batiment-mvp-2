"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field } from "@/components/field";
import type { CompanyFormState } from "./action-state";
import { saveCompanyAction } from "./actions";

/** Nombre entier de jours, de 1 à 999 (le serveur refuse au-delà de 365). */
const DAYS_PATTERN = "[1-9][0-9]{0,2}";
/** Même forme que la règle serveur : texte@domaine.extension, sans espace. */
const EMAIL_PATTERN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";

const tooLong = (max: number) => `Raccourcissez ce texte à ${max} caractères au maximum.`;

export function CompanyForm({ initial }: { initial: CompanyFormState }) {
  const [state, formAction, pending] = useActionState(saveCompanyAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Après une réponse en erreur, le focus va au premier champ en erreur.
  useEffect(() => {
    if (state.at === 0 || state.ok) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const v = state.values;
  const e = state.fieldErrors;
  const status = pending
    ? "Enregistrement…"
    : !state.ok && Object.keys(e).length > 0
      ? "Coordonnées non enregistrées. Corrigez les champs signalés."
      : state.message;

  return (
    <section aria-labelledby="company-title" className="flex flex-col gap-4">
      <h2 id="company-title" className="text-lg font-semibold">
        Coordonnées
      </h2>
      <form ref={formRef} action={formAction} aria-labelledby="company-title" className="flex flex-col gap-4">
        <p className="text-sm text-stone-600">
          <span aria-hidden="true">* </span>Seule la raison sociale est obligatoire.
        </p>
        <Field
          name="name"
          label="Raison sociale"
          required
          error="Saisissez la raison sociale de l'entreprise."
          serverError={e.name}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              defaultValue={v.name}
              maxLength={120}
              autoComplete="organization"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field name="street" label="Rue" error={tooLong(120)} serverError={e.street}>
          {(control) => (
            <input
              {...control}
              type="text"
              defaultValue={v.street}
              maxLength={120}
              autoComplete="address-line1"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field name="postalCity" label="NPA et localité" error={tooLong(120)} serverError={e.postalCity}>
          {(control) => (
            <input
              {...control}
              type="text"
              defaultValue={v.postalCity}
              maxLength={120}
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="phone"
          label="Téléphone"
          error="Saisissez un numéro de téléphone, par exemple 021 123 45 67."
          serverError={e.phone}
        >
          {(control) => (
            <input
              {...control}
              type="tel"
              defaultValue={v.phone}
              maxLength={40}
              autoComplete="tel"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="email"
          label="E-mail"
          error="Saisissez une adresse e-mail complète, par exemple contact@exemple.ch."
          serverError={e.email}
        >
          {(control) => (
            <input
              {...control}
              type="email"
              defaultValue={v.email}
              pattern={EMAIL_PATTERN}
              maxLength={120}
              autoComplete="email"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="website"
          label="Site web"
          hint="Adresse complète, par exemple https://www.exemple.ch"
          error="Saisissez une adresse complète, en commençant par https://."
          serverError={e.website}
        >
          {(control) => (
            <input
              {...control}
              type="url"
              defaultValue={v.website}
              maxLength={120}
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="vatNumber"
          label="Numéro IDE / TVA"
          hint="Format CHE-123.456.789 TVA ; laisser vide si l'entreprise n'est pas assujettie."
          error={tooLong(40)}
          serverError={e.vatNumber}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              defaultValue={v.vatNumber}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field name="iban" label="IBAN" error={tooLong(42)} serverError={e.iban}>
          {(control) => (
            <input
              {...control}
              type="text"
              defaultValue={v.iban}
              maxLength={42}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="validityDays"
          label="Validité de l'offre (jours)"
          hint="Nombre entier de jours, de 1 à 365."
          error="Saisissez un nombre entier de jours, de 1 à 365."
          serverError={e.validityDays}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              inputMode="numeric"
              pattern={DAYS_PATTERN}
              defaultValue={v.validityDays}
              maxLength={3}
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="paymentTerms"
          label="Conditions de paiement"
          error={tooLong(120)}
          serverError={e.paymentTerms}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              defaultValue={v.paymentTerms}
              maxLength={120}
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </Field>
        <Field
          name="footerNote"
          label="Remarques de pied de devis"
          error={tooLong(1000)}
          serverError={e.footerNote}
        >
          {(control) => (
            <textarea
              {...control}
              rows={5}
              defaultValue={v.footerNote}
              maxLength={1000}
              autoComplete="off"
              className={`${control.className} py-2`}
            />
          )}
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-stone-900 px-4 text-base font-semibold text-white active:bg-stone-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer les coordonnées"}
        </button>
      </form>
      <p
        role="status"
        className={`text-sm font-medium ${pending ? "text-stone-700" : state.ok ? "text-green-800" : "text-red-700"}`}
      >
        {status}
      </p>
    </section>
  );
}
