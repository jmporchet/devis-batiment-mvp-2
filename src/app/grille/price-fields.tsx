"use client";

import { Field } from "@/components/field";
import { UNITS, UNIT_LABELS, type Unit } from "@/domain/types";

/** Montant en francs : chiffres, apostrophes de milliers, 2 décimales max. */
const PRICE_PATTERN = "[0-9][0-9']*([.,][0-9]{1,2})?";

/** Champs communs à l'ajout et à la modification d'un poste. */
export function PriceItemFields({
  label,
  unit,
  price,
  fieldErrors,
}: {
  label: string;
  unit: Unit | string;
  price: string;
  fieldErrors: Record<string, string>;
}) {
  return (
    <>
      <Field
        name="label"
        label="Libellé"
        required
        error="Saisissez un libellé d'au moins 3 caractères."
        serverError={fieldErrors.label}
      >
        {(control) => (
          <input
            {...control}
            type="text"
            defaultValue={label}
            minLength={3}
            maxLength={200}
            autoComplete="off"
            enterKeyHint="next"
          />
        )}
      </Field>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
        <Field
          name="unit"
          label="Unité"
          required
          error="Choisissez une unité."
          serverError={fieldErrors.unit}
        >
          {(control) => (
            <select {...control} defaultValue={unit}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          name="price"
          label="Prix HT (CHF)"
          hint="Ex. 125.50"
          required
          error="Saisissez un montant en francs, par exemple 125 ou 125.50."
          serverError={fieldErrors.price}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              inputMode="decimal"
              pattern={PRICE_PATTERN}
              defaultValue={price}
              autoComplete="off"
              enterKeyHint="done"
            />
          )}
        </Field>
      </div>
    </>
  );
}
