"use client";

import { formatAmount, formatChf, parseChf } from "@/domain/money";
import { lineTotalCents } from "@/domain/pricing";
import { formatQuantity, parseQuantity } from "@/domain/quantity";
import { UNITS, UNIT_LABELS, type Unit } from "@/domain/types";
import { draftToLine, type LineDraft, type LineErrors } from "./line-drafts";
import { inputClass, secondaryButtonClass } from "./ui";

export interface LineRowProps {
  draft: LineDraft;
  index: number;
  count: number;
  errors?: LineErrors;
  /** Erreur renvoyée par le serveur pour cette ligne. */
  serverError?: string;
  readOnly: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

export function lineFieldId(key: string, field: string): string {
  return `line-${key}-${field}`;
}

const badgeClass = "rounded px-1.5 py-0.5 text-xs font-medium";

export function LineRow({
  draft,
  index,
  count,
  errors = {},
  serverError,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: LineRowProps) {
  const line = draftToLine(draft);
  let total: number | null = null;
  try {
    total = line ? lineTotalCents(line) : null;
  } catch {
    total = null;
  }
  const unpriced = draft.priceText.trim() === "";
  const n = index + 1;
  const id = (field: string) => lineFieldId(draft.key, field);

  const badges = (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
      <span className="font-medium">Ligne {n}</span>
      {draft.priceItemId && <span className="tracking-wide">{draft.priceItemId}</span>}
      {draft.source === "ai" && (
        <span className={`${badgeClass} bg-sky-100 text-sky-900`}>IA</span>
      )}
      {unpriced && <span className={`${badgeClass} bg-amber-100 text-amber-900`}>À chiffrer</span>}
    </p>
  );

  if (readOnly) {
    const qty = parseQuantity(draft.quantityText);
    const price = parseChf(draft.priceText);
    return (
      <li className="flex flex-col gap-1 py-3">
        {badges}
        <p className="text-base leading-snug">{draft.label}</p>
        <p className="flex items-baseline justify-between gap-3 text-sm text-stone-700">
          <span>
            {qty === null ? draft.quantityText : formatQuantity(qty)} {UNIT_LABELS[draft.unit]}
            {price !== null && ` × ${formatAmount(price)}`}
          </span>
          <span className="text-base font-semibold tabular-nums text-stone-900">
            {total === null ? "—" : formatChf(total)}
          </span>
        </p>
      </li>
    );
  }

  const describedBy = (field: "label" | "quantity" | "price", error?: string) =>
    error ? id(`${field}-error`) : undefined;

  return (
    <li className="flex flex-col gap-3 py-4">
      {badges}

      <div className="flex flex-col gap-1">
        <label htmlFor={id("label")} className="text-sm font-medium">
          Libellé
        </label>
        <textarea
          id={id("label")}
          rows={2}
          value={draft.label}
          maxLength={300}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-invalid={errors.label ? true : undefined}
          aria-describedby={describedBy("label", errors.label)}
          className={`${inputClass} resize-none py-2 leading-snug`}
        />
        {errors.label && (
          <p id={id("label-error")} className="text-sm text-red-700">
            {errors.label}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id("quantity")} className="text-sm font-medium">
            Quantité
          </label>
          <div className="flex items-center gap-2">
            <input
              id={id("quantity")}
              inputMode="decimal"
              autoComplete="off"
              value={draft.quantityText}
              onChange={(e) => onChange({ quantityText: e.target.value })}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => {
                const parsed = parseQuantity(draft.quantityText);
                if (parsed !== null && formatQuantity(parsed) !== draft.quantityText) {
                  onChange({ quantityText: formatQuantity(parsed) });
                }
              }}
              aria-invalid={errors.quantity ? true : undefined}
              aria-describedby={describedBy("quantity", errors.quantity)}
              className={`${inputClass} flex-1 text-right tabular-nums`}
            />
            {draft.priceItemId === null ? (
              <select
                aria-label={`Unité de la ligne ${n}`}
                value={draft.unit}
                onChange={(e) => onChange({ unit: e.target.value as Unit })}
                className={`${inputClass.replace("w-full", "")} w-[6rem] shrink-0 px-1 text-sm`}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="shrink-0 text-base text-stone-700">{UNIT_LABELS[draft.unit]}</span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id("price")} className="text-sm font-medium">
            Prix unitaire HT
          </label>
          <input
            id={id("price")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="à chiffrer"
            value={draft.priceText}
            onChange={(e) => onChange({ priceText: e.target.value })}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => {
              const cents = parseChf(draft.priceText);
              if (cents !== null && formatAmount(cents) !== draft.priceText) {
                onChange({ priceText: formatAmount(cents) });
              }
            }}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={describedBy("price", errors.price)}
            className={`${inputClass} text-right tabular-nums`}
          />
        </div>
      </div>
      {errors.quantity && (
        <p id={id("quantity-error")} className="text-sm text-red-700">
          {errors.quantity}
        </p>
      )}
      {errors.price && (
        <p id={id("price-error")} className="text-sm text-red-700">
          {errors.price}
        </p>
      )}
      {serverError && (
        <p role="alert" className="text-sm text-red-700">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            id={id("up")}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Monter la ligne ${n}`}
            className={secondaryButtonClass}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            id={id("down")}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`Descendre la ligne ${n}`}
            className={secondaryButtonClass}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Supprimer la ligne ${n}`}
            className={`${secondaryButtonClass} text-red-800`}
          >
            Supprimer
          </button>
        </div>
        <p className="ml-auto text-right">
          <span className="block text-xs text-stone-500">Total HT</span>
          <span className="text-base font-semibold tabular-nums" data-testid={`line-total-${index}`}>
            {total === null ? "—" : formatChf(total)}
          </span>
        </p>
      </div>
    </li>
  );
}
