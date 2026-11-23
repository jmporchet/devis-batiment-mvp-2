"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { formatAmount, formatChf } from "@/domain/money";
import { UNIT_LABELS, type PriceItem } from "@/domain/types";
import { INITIAL_STATE } from "./action-state";
import { setPriceItemActiveAction, updatePriceItemAction } from "./actions";
import { PriceItemFields } from "./price-fields";

const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-sm font-medium";

/**
 * Un poste de la grille. La modification s'ouvre dans un <details> natif et
 * les formulaires appellent directement les Server Actions (via bind) : tout
 * fonctionne aussi sans JavaScript.
 */
export function PriceItemRow({ item }: { item: PriceItem }) {
  const labelId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updatePriceItemAction.bind(null, item.id),
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state === INITIAL_STATE) return;
    if (state.ok) {
      if (detailsRef.current) detailsRef.current.open = false;
    } else {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const v = state.values;

  return (
    <li className={`py-3 ${item.active ? "" : "text-stone-500"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-xs font-medium tracking-wide text-stone-600">
            {item.id}
            {!item.active && (
              <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-stone-800">Inactif</span>
            )}
          </p>
          <p id={labelId} className="leading-snug">
            {item.label}
          </p>
        </div>
        <p className="shrink-0 text-right font-semibold tabular-nums">
          {formatChf(item.unitPriceCents)}
          <span className="block text-xs font-normal text-stone-600">/ {UNIT_LABELS[item.unit]}</span>
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-start gap-2">
        <details ref={detailsRef} className="group min-w-0 open:basis-full">
          <summary className={`${buttonClass} w-fit cursor-pointer border border-stone-500 bg-white`}>
            <span className="group-open:hidden">Modifier</span>
            <span className="hidden group-open:inline">Fermer</span>
            <span className="visually-hidden"> {item.label}</span>
          </summary>
          <form
            key={state.at}
            ref={formRef}
            action={formAction}
            aria-labelledby={labelId}
            className="mt-3 flex flex-col gap-4 rounded-lg bg-stone-100 p-3"
          >
            <PriceItemFields
              label={v?.label ?? item.label}
              unit={v?.unit ?? item.unit}
              price={v?.price ?? formatAmount(item.unitPriceCents)}
              fieldErrors={state.fieldErrors}
            />
            <button
              type="submit"
              disabled={pending}
              className={`${buttonClass} bg-stone-900 text-white disabled:opacity-60`}
            >
              {pending ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </form>
        </details>
        <form action={setPriceItemActiveAction.bind(null, item.id, !item.active)}>
          <button type="submit" className={`${buttonClass} text-stone-800 underline`}>
            {item.active ? "Désactiver" : "Réactiver"}
            <span className="visually-hidden"> {item.label}</span>
          </button>
        </form>
      </div>

      <p role="status" className={`text-sm ${state.ok ? "text-green-800" : "text-red-700"}`}>
        {state.message}
      </p>
    </li>
  );
}
