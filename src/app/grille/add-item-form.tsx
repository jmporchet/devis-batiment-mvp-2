"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Field } from "@/components/field";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/domain/types";
import { INITIAL_STATE } from "./action-state";
import { createPriceItemAction } from "./actions";
import { PriceItemFields } from "./price-fields";

/**
 * Ajout d'un poste, replié dans un <details> natif. Le code est proposé
 * selon la catégorie et reste modifiable : le champ est remonté (key) quand
 * la catégorie ou le code proposé change. Les champs sont non contrôlés
 * (defaultValue) et le formulaire est remonté après chaque réponse : les
 * valeurs renvoyées en cas d'erreur sont ainsi rétablies.
 */
export function AddItemForm({ suggestedCodes }: { suggestedCodes: Record<Category, string> }) {
  const [category, setCategory] = useState<Category>("divers");
  const [state, formAction, pending] = useActionState(createPriceItemAction, INITIAL_STATE);
  const summaryId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === INITIAL_STATE) return;
    if (state.ok) {
      if (detailsRef.current) detailsRef.current.open = false;
    } else {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const v = state.values;
  const suggested = suggestedCodes[category];

  return (
    <div>
      <details ref={detailsRef} className="rounded-xl border border-stone-300 bg-white">
        <summary id={summaryId} className="flex min-h-12 cursor-pointer items-center px-4 font-medium">
          Ajouter un poste
        </summary>
        <form
          key={state.at}
          ref={formRef}
          action={formAction}
          aria-labelledby={summaryId}
          className="flex flex-col gap-4 border-t border-stone-200 p-4"
        >
          <p className="text-sm text-stone-600">
            <span aria-hidden="true">* </span>Tous les champs sont obligatoires.
          </p>
          <Field
            name="category"
            label="Catégorie"
            required
            error="Choisissez une catégorie."
            serverError={state.fieldErrors.category}
          >
            {(control) => (
              <select
                {...control}
                defaultValue={v?.category ?? category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            name="id"
            label="Code"
            hint={`Trois lettres, un tiret, trois chiffres. Proposé : ${suggested}`}
            required
            error="Saisissez un code au format ABC-123."
            serverError={state.fieldErrors.id}
          >
            {(control) => (
              <input
                {...control}
                key={`${category}-${suggested}`}
                type="text"
                defaultValue={v?.category === category && v.id ? v.id : suggested}
                pattern="[A-Za-z]{3}-[0-9]{3}"
                maxLength={7}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                enterKeyHint="next"
                className={`${control.className} uppercase`}
              />
            )}
          </Field>
          <PriceItemFields
            label={v?.label ?? ""}
            unit={v?.unit ?? "m2"}
            price={v?.price ?? ""}
            fieldErrors={state.fieldErrors}
          />
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Ajout…" : "Ajouter le poste"}
          </button>
        </form>
      </details>
      <p role="status" className={`mt-2 text-sm ${state.ok ? "text-green-800" : "text-red-700"}`}>
        {state.message}
      </p>
    </div>
  );
}
