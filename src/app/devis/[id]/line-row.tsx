"use client";

import { useState } from "react";
import { formatAmount, formatChf, parseChf } from "@/domain/money";
import { lineTotalCents } from "@/domain/pricing";
import { formatQuantity, parseQuantity } from "@/domain/quantity";
import { UNITS, UNIT_LABELS, type Unit } from "@/domain/types";
import { draftToLine, type LineDraft, type LineErrors } from "./line-drafts";
import { ErrorIcon } from "@/components/field";
import { inputClass, secondaryButtonClass } from "./ui";

export interface LineRowProps {
  draft: LineDraft;
  index: number;
  count: number;
  errors?: LineErrors;
  /** Erreur renvoyée par le serveur pour cette ligne. */
  serverError?: string;
  readOnly: boolean;
  /** Affiche d'emblée les erreurs de saisie (après une tentative d'enregistrement). */
  showErrors?: boolean;
  /** Une saisie invalide vient d'être quittée : à annoncer dans la région de statut. */
  onInvalidBlur: (message: string) => void;
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
  showErrors = false,
  onInvalidBlur,
  onChange,
  onMove,
  onRemove,
}: LineRowProps) {
  // Une erreur de saisie n'apparaît qu'après avoir quitté le champ (ou après
  // une tentative d'enregistrement), et disparaît dès que la saisie est corrigée.
  const [touched, setTouched] = useState<Partial<Record<keyof LineErrors, boolean>>>({});
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
  const shown = (field: keyof LineErrors) => (touched[field] || showErrors ? errors[field] : undefined);
  /** Toute frappe efface l'erreur affichée : elle revient en quittant le champ, si la saisie reste invalide. */
  const edit = (field: keyof LineErrors, patch: Partial<LineDraft>) => {
    setTouched((current) => (current[field] ? { ...current, [field]: false } : current));
    onChange(patch);
  };
  const blur = (field: keyof LineErrors, name: string) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
    const message = errors[field];
    if (message) onInvalidBlur(`${name}, ligne ${n} : ${message}`);
  };

  const badges = (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
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

  const labelError = shown("label");
  const quantityError = shown("quantity");
  const priceError = shown("price");

  return (
    <li className="flex flex-col gap-3 py-4">
      {badges}

      <div className="flex flex-col gap-1">
        <label htmlFor={id("label")} className="text-sm font-medium">
          Libellé<span className="visually-hidden">, ligne {n}</span>
        </label>
        <textarea
          id={id("label")}
          name={`lignes[${index}].libelle`}
          rows={2}
          value={draft.label}
          maxLength={300}
          onChange={(e) => edit("label", { label: e.target.value })}
          onBlur={() => blur("label", "Libellé")}
          aria-invalid={labelError ? "true" : "false"}
          aria-describedby={labelError ? id("label-error") : undefined}
          className={`${inputClass} resize-none py-2 leading-snug`}
        />
        {labelError && (
          <p id={id("label-error")} className="flex items-start gap-1 text-sm text-red-700">
            <ErrorIcon />
            {labelError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id("quantity")} className="text-sm font-medium">
            Quantité<span className="visually-hidden">, ligne {n}</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id={id("quantity")}
              name={`lignes[${index}].quantite`}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              value={draft.quantityText}
              onChange={(e) => edit("quantity", { quantityText: e.target.value })}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => {
                const parsed = parseQuantity(draft.quantityText);
                if (parsed !== null && formatQuantity(parsed) !== draft.quantityText) {
                  onChange({ quantityText: formatQuantity(parsed) });
                }
                blur("quantity", "Quantité");
              }}
              aria-invalid={quantityError ? "true" : "false"}
              aria-describedby={quantityError ? id("quantity-error") : undefined}
              className={`${inputClass} flex-1 text-right tabular-nums`}
            />
            {draft.priceItemId === null ? (
              <>
                <label htmlFor={id("unit")} className="visually-hidden">
                  Unité, ligne {n}
                </label>
                <select
                  id={id("unit")}
                  name={`lignes[${index}].unite`}
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
              </>
            ) : (
              <span className="shrink-0 text-base text-stone-700">{UNIT_LABELS[draft.unit]}</span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id("price")} className="text-sm font-medium">
            Prix unitaire HT<span className="visually-hidden">, ligne {n}</span>
          </label>
          <input
            id={id("price")}
            name={`lignes[${index}].prix`}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="à chiffrer"
            value={draft.priceText}
            onChange={(e) => edit("price", { priceText: e.target.value })}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => {
              const cents = parseChf(draft.priceText);
              if (cents !== null && formatAmount(cents) !== draft.priceText) {
                onChange({ priceText: formatAmount(cents) });
              }
              blur("price", "Prix unitaire HT");
            }}
            aria-invalid={priceError ? "true" : "false"}
            aria-describedby={priceError ? id("price-error") : undefined}
            className={`${inputClass} text-right tabular-nums`}
          />
        </div>
      </div>
      {quantityError && (
        <p id={id("quantity-error")} className="flex items-start gap-1 text-sm text-red-700">
          <ErrorIcon />
          {quantityError}
        </p>
      )}
      {priceError && (
        <p id={id("price-error")} className="flex items-start gap-1 text-sm text-red-700">
          <ErrorIcon />
          {priceError}
        </p>
      )}
      {serverError && (
        // Reçoit le focus après un refus du serveur : la ligne fautive est annoncée.
        <p
          id={id("server-error")}
          tabIndex={-1}
          className="flex items-start gap-1 rounded text-sm text-red-700"
        >
          <ErrorIcon />
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
            id={id("remove")}
            onClick={onRemove}
            aria-label={`Supprimer la ligne ${n}`}
            className={`${secondaryButtonClass} text-red-800`}
          >
            Supprimer
          </button>
        </div>
        <p className="ml-auto text-right">
          <span className="block text-xs text-stone-600">Total HT</span>
          <span className="text-base font-semibold tabular-nums" data-testid={`line-total-${index}`}>
            {total === null ? "—" : formatChf(total)}
          </span>
        </p>
      </div>
    </li>
  );
}
