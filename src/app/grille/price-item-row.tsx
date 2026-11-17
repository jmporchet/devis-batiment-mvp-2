"use client";

import { useActionState, useState } from "react";
import { formatAmount, formatChf } from "@/domain/money";
import { UNITS, UNIT_LABELS, type PriceItem } from "@/domain/types";
import { INITIAL_STATE, type ActionState } from "./action-state";
import { setPriceItemActiveAction, updatePriceItemAction } from "./actions";

const inputClass =
  "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-300";
const buttonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-4 text-sm font-medium";

export function PriceItemRow({ item }: { item: PriceItem }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await updatePriceItemAction(item.id, prev, formData);
      if (result.ok) setEditing(false);
      return result;
    },
    INITIAL_STATE,
  );

  return (
    <li className={`py-3 ${item.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-stone-500">
            {item.id}
            {!item.active && (
              <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-stone-700">
                Inactif
              </span>
            )}
          </p>
          <p className="text-base leading-snug">{item.label}</p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold tabular-nums">
          {formatChf(item.unitPriceCents)}
          <span className="block text-xs font-normal text-stone-500">
            / {UNIT_LABELS[item.unit]}
          </span>
        </p>
      </div>

      {editing ? (
        <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-lg bg-stone-100 p-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Libellé
            <input
              name="label"
              defaultValue={item.label}
              required
              maxLength={200}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Unité
              <select name="unit" defaultValue={item.unit} className={inputClass}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Prix HT (CHF)
              <input
                name="price"
                defaultValue={formatAmount(item.unitPriceCents)}
                inputMode="decimal"
                required
                className={inputClass}
              />
            </label>
          </div>
          {state.message && !state.ok && (
            <p role="alert" className="text-sm text-red-700">
              {state.message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className={`${buttonClass} flex-1 bg-stone-900 text-white disabled:opacity-60`}
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={`${buttonClass} border border-stone-300 bg-white`}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${buttonClass} border border-stone-300 bg-white`}
          >
            Modifier
          </button>
          <form action={setPriceItemActiveAction.bind(null, item.id, !item.active)}>
            <button type="submit" className={`${buttonClass} text-stone-700 underline`}>
              {item.active ? "Désactiver" : "Réactiver"}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
