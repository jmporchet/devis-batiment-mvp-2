"use client";

import { useActionState, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, UNITS, UNIT_LABELS, type Category } from "@/domain/types";
import { INITIAL_STATE } from "./action-state";
import { createPriceItemAction } from "./actions";

const inputClass =
  "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-300";

/**
 * Formulaire d'ajout. Le code est proposé selon la catégorie choisie ; il
 * reste modifiable. Le parent change la `key` après un ajout pour repartir
 * d'un formulaire vide avec les nouveaux codes proposés.
 */
export function AddItemForm({
  suggestedCodes,
}: {
  suggestedCodes: Record<Category, string>;
}) {
  const [category, setCategory] = useState<Category>("divers");
  const [customCode, setCustomCode] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createPriceItemAction, INITIAL_STATE);
  const code = customCode ?? suggestedCodes[category];

  return (
    <details className="rounded-xl border border-stone-200 bg-white" open={state.message !== "" && !state.ok}>
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-base font-medium">
        Ajouter un poste
      </summary>
      <form action={formAction} className="flex flex-col gap-3 border-t border-stone-200 p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Catégorie
          <select
            name="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category);
              setCustomCode(null);
            }}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Code
          <input
            name="id"
            value={code}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
            required
            maxLength={7}
            autoCapitalize="characters"
            className={inputClass}
          />
          {state.fieldErrors.id && (
            <span className="text-sm font-normal text-red-700">{state.fieldErrors.id}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Libellé
          <input name="label" required maxLength={200} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Unité
            <select name="unit" defaultValue="m2" className={inputClass}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Prix HT (CHF)
            <input name="price" inputMode="decimal" required placeholder="0.00" className={inputClass} />
          </label>
        </div>
        {state.message && !state.ok && (
          <p role="alert" className="text-sm text-red-700">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Ajout…" : "Ajouter le poste"}
        </button>
      </form>
    </details>
  );
}
