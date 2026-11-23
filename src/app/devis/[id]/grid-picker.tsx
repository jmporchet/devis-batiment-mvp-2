"use client";

import { useId, useMemo, useState } from "react";
import { formatChf } from "@/domain/money";
import { CATEGORY_LABELS, UNIT_LABELS, type PriceItem } from "@/domain/types";
import { filterPriceItems, groupByCategory } from "./line-drafts";
import { inputClass } from "./ui";

/**
 * Choix d'un poste actif de la grille : filtre texte dans un élément
 * <search>, résultats groupés par catégorie. Le conteneur repliable
 * (<details>) est fourni par l'éditeur.
 */
export function GridPicker({
  items,
  onPick,
}: {
  items: PriceItem[];
  onPick: (item: PriceItem) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupByCategory(filterPriceItems(items, query)), [items, query]);
  const id = useId();

  return (
    <div className="flex flex-col gap-3 border-t border-stone-200 p-3">
      <search className="flex flex-col gap-1">
        <label htmlFor={`${id}-filtre`} className="text-sm font-medium">
          Filtrer les postes
        </label>
        <p id={`${id}-aide`} className="text-sm text-stone-600">
          Par libellé ou par code, par exemple « carrelage » ou « MAC ».
        </p>
        <input
          id={`${id}-filtre`}
          name="q"
          type="search"
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${id}-aide`}
          className={inputClass}
        />
      </search>
      <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
        {groups.length === 0 && (
          <p className="px-1 py-3 text-sm text-stone-700">
            Aucun poste ne correspond à « {query} ». Essayez un autre mot ou effacez le filtre.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.category}>
            <h3
              id={`${id}-cat-${group.category}`}
              className="sticky top-0 bg-stone-100 px-2 py-1 text-sm font-semibold text-stone-800"
            >
              {CATEGORY_LABELS[group.category]}
            </h3>
            <ul aria-labelledby={`${id}-cat-${group.category}`} className="divide-y divide-stone-100">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex min-h-11 w-full items-start justify-between gap-3 px-2 py-2 text-left active:bg-stone-100"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs tracking-wide text-stone-600">{item.id}</span>
                      <span className="block text-base leading-snug">{item.label}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {formatChf(item.unitPriceCents)}
                      <span className="block text-xs text-stone-600">/ {UNIT_LABELS[item.unit]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
