"use client";

import { useMemo, useState } from "react";
import { formatChf } from "@/domain/money";
import { CATEGORY_LABELS, UNIT_LABELS, type PriceItem } from "@/domain/types";
import { filterPriceItems, groupByCategory } from "./line-drafts";
import { inputClass, secondaryButtonClass } from "./ui";

/** Choix d'un poste actif de la grille, groupé par catégorie, avec filtre texte. */
export function GridPicker({
  items,
  onPick,
  onClose,
}: {
  items: PriceItem[];
  onPick: (item: PriceItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupByCategory(filterPriceItems(items, query)), [items, query]);

  return (
    <section
      aria-label="Choisir un poste de la grille"
      className="flex flex-col gap-3 rounded-xl border border-stone-300 bg-white p-3"
    >
      <div className="flex items-center gap-2">
        <input
          type="search"
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par libellé ou code"
          aria-label="Filtrer les postes par libellé ou code"
          className={inputClass}
        />
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          Fermer
        </button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
        {groups.length === 0 && (
          <p className="px-1 py-3 text-sm text-stone-600">Aucun poste ne correspond à « {query} ».</p>
        )}
        {groups.map((group) => (
          <div key={group.category}>
            <h3 className="sticky top-0 bg-stone-100 px-2 py-1 text-sm font-semibold text-stone-700">
              {CATEGORY_LABELS[group.category]}
            </h3>
            <ul className="divide-y divide-stone-100">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex min-h-11 w-full items-start justify-between gap-3 px-2 py-2 text-left active:bg-stone-100"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs tracking-wide text-stone-500">{item.id}</span>
                      <span className="block text-base leading-snug">{item.label}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {formatChf(item.unitPriceCents)}
                      <span className="block text-xs text-stone-500">/ {UNIT_LABELS[item.unit]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
