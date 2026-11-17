"use client";

import { useActionState } from "react";
import type { CompanyFormState, FieldName } from "./action-state";
import { saveCompanyAction } from "./actions";

const inputClass =
  "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-300 aria-invalid:border-red-600";

interface FieldProps {
  name: FieldName;
  label: string;
  state: CompanyFormState;
  help?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
}

function Field({ name, label, state, help, required, type = "text", autoComplete, inputMode, maxLength }: FieldProps) {
  const error = state.fieldErrors[name];
  const errorId = `${name}-error`;
  const helpId = `${name}-help`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={state.values[name]}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={[help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        className={inputClass}
      />
      {help && (
        <p id={helpId} className="text-sm text-stone-600">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function CompanyForm({ initial }: { initial: CompanyFormState }) {
  const [state, formAction, pending] = useActionState(saveCompanyAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field name="name" label="Raison sociale" state={state} required autoComplete="organization" maxLength={120} />
      <Field name="street" label="Rue" state={state} autoComplete="address-line1" maxLength={120} />
      <Field name="postalCity" label="NPA et localité" state={state} autoComplete="off" maxLength={120} />
      <Field name="phone" label="Téléphone" state={state} type="tel" autoComplete="tel" maxLength={40} />
      <Field name="email" label="E-mail" state={state} type="email" autoComplete="email" maxLength={120} />
      <Field name="website" label="Site web" state={state} autoComplete="url" maxLength={120} />
      <Field
        name="vatNumber"
        label="Numéro IDE / TVA"
        state={state}
        autoComplete="off"
        maxLength={40}
        help="Format CHE-123.456.789 TVA ; laisser vide si l'entreprise n'est pas assujettie"
      />
      <Field name="iban" label="IBAN" state={state} autoComplete="off" maxLength={42} />
      <Field
        name="validityDays"
        label="Validité de l'offre (jours)"
        state={state}
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
      />
      <Field name="paymentTerms" label="Conditions de paiement" state={state} autoComplete="off" maxLength={120} />
      <div className="flex flex-col gap-1">
        <label htmlFor="footerNote" className="text-sm font-medium">
          Remarques de pied de devis
        </label>
        <textarea
          id="footerNote"
          name="footerNote"
          rows={5}
          defaultValue={state.values.footerNote}
          maxLength={1000}
          aria-invalid={state.fieldErrors.footerNote ? true : undefined}
          aria-describedby={state.fieldErrors.footerNote ? "footerNote-error" : undefined}
          className={`${inputClass} py-2`}
        />
        {state.fieldErrors.footerNote && (
          <p id="footerNote-error" className="text-sm text-red-700">
            {state.fieldErrors.footerNote}
          </p>
        )}
      </div>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm font-medium text-green-800" : "text-sm font-medium text-red-700"}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-xl bg-stone-900 px-4 text-base font-semibold text-white active:bg-stone-700 disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
