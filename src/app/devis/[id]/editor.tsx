"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { formatChf } from "@/domain/money";
import { computeTotals } from "@/domain/pricing";
import {
  QUOTE_STATUS_LABELS,
  UNITS,
  UNIT_LABELS,
  type PriceItem,
  type QuoteInfo,
  type QuoteLine,
  type QuoteStatus,
  type Unit,
} from "@/domain/types";
import type { ActionResult } from "./action-result";
import { generateDraftAction, saveInfoAction, saveLinesAction, setStatusAction } from "./actions";
import { GridPicker } from "./grid-picker";
import { LineRow, lineFieldId } from "./line-row";
import {
  convertDrafts,
  draftFromLine,
  draftFromPriceItem,
  draftOffGrid,
  draftsSignature,
  moveItem,
  type LineDraft,
} from "./line-drafts";
import { buttonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export interface EditorAi {
  /** OPENROUTER_API_KEY présente côté serveur. */
  enabled: boolean;
  /** Le devis a des photos ou une note vocale à analyser. */
  hasMedia: boolean;
  /** Lancer l'analyse dès l'ouverture (arrivée depuis la capture). */
  autoStart: boolean;
}

export interface EditorQuote {
  id: number;
  number: string;
  createdAtLabel: string;
  status: QuoteStatus;
  info: QuoteInfo;
  lines: QuoteLine[];
}

interface Message {
  kind: "ok" | "error";
  text: string;
  /** Erreurs par numéro de ligne (0 = première), renvoyées par le serveur. */
  lineErrors?: Record<number, string>;
  /** Le message disparaît dès que le contenu change. */
  at: string;
}

type Focus = { key: string; field: "quantity" | "up" | "down" };

const SAVE_ERROR = "Enregistrement impossible. Vérifiez la connexion et réessayez.";

function lineErrorsFrom(fieldErrors: Record<string, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [name, message] of Object.entries(fieldErrors)) {
    const match = /^lines\.(\d+)$/.exec(name);
    if (match) out[Number(match[1])] = message;
  }
  return out;
}

export function Editor({
  quote,
  priceItems,
  media,
  ai,
}: {
  quote: EditorQuote;
  priceItems: PriceItem[];
  ai: EditorAi;
  /** Photos et note vocale, rendues côté serveur. */
  media: ReactNode;
}) {
  const nextKey = useRef(quote.lines.length);
  const makeKey = () => `l${nextKey.current++}`;

  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [info, setInfo] = useState<QuoteInfo>(quote.info);
  const [savedInfo, setSavedInfo] = useState<QuoteInfo>(quote.info);
  const [drafts, setDrafts] = useState<LineDraft[]>(() =>
    quote.lines.map((line, i) => draftFromLine(line, `l${i}`)),
  );
  const [savedSignature, setSavedSignature] = useState(() => draftsSignature(drafts));
  const [panel, setPanel] = useState<"grid" | "free" | null>(null);
  const [freeLabel, setFreeLabel] = useState("");
  const [freeUnit, setFreeUnit] = useState<Unit>("forfait");
  const [saving, setBusy] = useState(false);
  /**
   * Analyse IA dans une transition : `isPending` s'affiche tout de suite, même
   * quand l'analyse est lancée depuis un effet (arrivée depuis la capture).
   */
  const [aiRunning, startAi] = useTransition();
  const busy = saving || aiRunning;
  const autoStarted = useRef(false);
  const scrollToLines = useRef(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [removed, setRemoved] = useState<{ draft: LineDraft; index: number } | null>(null);
  const focusRequest = useRef<Focus | null>(null);

  const readOnly = status === "valide";
  const signature = draftsSignature(drafts);
  const infoDirty = JSON.stringify(info) !== JSON.stringify(savedInfo);
  const linesDirty = signature !== savedSignature;
  const dirty = infoDirty || linesDirty;
  /** Identifie le contenu courant : un message n'est valable que pour lui. */
  const contentId = `${signature}|${JSON.stringify(info)}`;
  const visibleMessage = message && message.at === contentId ? message : null;

  const converted = useMemo(() => convertDrafts(drafts), [drafts]);
  const totals = useMemo(() => {
    try {
      return computeTotals(converted.validLines);
    } catch {
      return null;
    }
  }, [converted.validLines]);
  const unpricedCount = converted.validLines.filter((l) => l.unitPriceCents === null).length;

  // Focus demandé après un ajout ou un déplacement (le DOM est à jour ici).
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    document.getElementById(lineFieldId(request.key, request.field))?.focus();
  }, [drafts]);

  // Après un brouillon IA, amène le chef de chantier sur les lignes proposées.
  useEffect(() => {
    if (!scrollToLines.current) return;
    scrollToLines.current = false;
    document.getElementById("lignes-titre")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drafts]);

  // Avertit avant de quitter la page tant que des modifications ne sont pas enregistrées.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, readOnly]);

  function patchDraft(key: string, patch: Partial<LineDraft>) {
    setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function addDraft(draft: LineDraft) {
    focusRequest.current = { key: draft.key, field: "quantity" };
    setDrafts((current) => [...current, draft]);
    setRemoved(null);
    setPanel(null);
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const key = drafts[index].key;
    focusRequest.current = { key, field: direction === -1 ? "up" : "down" };
    setDrafts((current) => moveItem(current, index, direction));
  }

  function removeDraft(index: number) {
    setRemoved({ draft: drafts[index], index });
    setDrafts((current) => current.filter((_, i) => i !== index));
  }

  function undoRemove() {
    if (!removed) return;
    const { draft, index } = removed;
    setRemoved(null);
    setDrafts((current) => {
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, draft);
      return next;
    });
  }

  function fail(result: Extract<ActionResult, { ok: false }>) {
    setMessage({
      kind: "error",
      text: result.message,
      lineErrors: lineErrorsFrom(result.fieldErrors),
      at: contentId,
    });
  }

  async function save(): Promise<boolean> {
    if (busy || readOnly) return false;
    if (converted.lines === null) {
      setMessage({
        kind: "error",
        text:
          converted.invalidCount === 1
            ? "Une ligne contient une saisie invalide : corrigez-la pour enregistrer."
            : `${converted.invalidCount} lignes contiennent une saisie invalide : corrigez-les pour enregistrer.`,
        at: contentId,
      });
      return false;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (infoDirty) {
        const sent = info;
        const result = await saveInfoAction(quote.id, sent);
        if (!result.ok) {
          fail(result);
          return false;
        }
        setSavedInfo(sent);
      }
      if (linesDirty) {
        const result = await saveLinesAction(quote.id, converted.lines);
        if (!result.ok) {
          fail(result);
          return false;
        }
        setSavedSignature(signature);
      }
      setMessage({ kind: "ok", text: "Devis enregistré.", at: contentId });
      return true;
    } catch (error) {
      console.error(error);
      setMessage({ kind: "error", text: SAVE_ERROR, at: contentId });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: QuoteStatus) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await setStatusAction(quote.id, next);
      if (!result.ok) {
        fail(result);
        return;
      }
      setStatus(result.status);
      setMessage({
        kind: "ok",
        text: result.status === "valide" ? "Devis validé." : "Devis repassé en brouillon.",
        at: contentId,
      });
    } catch (error) {
      console.error(error);
      setMessage({ kind: "error", text: SAVE_ERROR, at: contentId });
    } finally {
      setBusy(false);
    }
  }

  /** Brouillon IA : remplace les lignes par la proposition du modèle. */
  function runAi(options: { confirm: boolean } = { confirm: true }) {
    if (busy || readOnly) return;
    if (options.confirm) {
      if (dirty && !window.confirm("Les modifications non enregistrées seront perdues. Continuer ?")) return;
      if (
        drafts.length > 0 &&
        !window.confirm(`Remplacer les ${drafts.length} lignes actuelles par la proposition de l'IA ?`)
      ) {
        return;
      }
    }
    setMessage(null);
    setRemoved(null);
    startAi(async () => {
      let result: ActionResult;
      try {
        result = await generateDraftAction(quote.id);
      } catch (error) {
        console.error(error);
        startAi(() =>
          setMessage({ kind: "error", text: "L'analyse a échoué. Vérifiez la connexion et réessayez.", at: contentId }),
        );
        return;
      }
      startAi(() => {
        if (!result.ok) {
          fail(result);
          return;
        }
        const next = result.lines.map((line) => draftFromLine(line, makeKey()));
        setDrafts(next);
        setSavedSignature(draftsSignature(next));
        setInfo(result.info);
        setSavedInfo(result.info);
        const unpriced = result.lines.filter((l) => l.unitPriceCents === null).length;
        setMessage({
          kind: "ok",
          text:
            `L'IA propose ${result.lines.length} ligne${result.lines.length > 1 ? "s" : ""}` +
            (unpriced > 0 ? `, dont ${unpriced} à chiffrer` : "") +
            ". Vérifiez les quantités et les points « À vérifier » dans les notes.",
          at: `${draftsSignature(next)}|${JSON.stringify(result.info)}`,
        });
        scrollToLines.current = true;
      });
    });
  }

  // Arrivée depuis la capture : analyse automatique, une seule fois.
  useEffect(() => {
    if (!ai.autoStart || !ai.enabled || autoStarted.current) return;
    autoStarted.current = true;
    // Retire ?ia=1 sans navigation (une navigation concurrente masquerait l'analyse).
    window.history.replaceState(null, "", `/devis/${quote.id}`);
    runAi({ confirm: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lancement unique au montage
  }, []);

  function addFreeLine() {
    if (freeLabel.trim() === "") return;
    addDraft(draftOffGrid(freeLabel, freeUnit, makeKey()));
    setFreeLabel("");
  }

  const total = totals ? formatChf(totals.totalCents) : "—";

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link
          href="/devis"
          onClick={(e) => {
            if (dirty && !readOnly && !window.confirm("Quitter sans enregistrer les modifications ?")) {
              e.preventDefault();
            }
          }}
          className="inline-flex min-h-11 items-center text-sm text-stone-600 underline"
        >
          Retour aux devis
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">Devis {quote.number}</h1>
          <span
            data-testid="statut"
            className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
              readOnly ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-800"
            }`}
          >
            {QUOTE_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-stone-600">Créé le {quote.createdAtLabel}</p>
      </header>

      {media}

      <section aria-labelledby="infos-titre" className="flex flex-col gap-3">
        <h2 id="infos-titre" className="text-lg font-semibold">
          Informations
        </h2>
        {readOnly ? (
          <dl className="flex flex-col gap-2 text-base">
            {(
              [
                ["Objet", info.title],
                ["Client", info.clientName],
                ["Adresse", info.clientAddress],
                ["Notes", info.notes],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm font-medium text-stone-600">{label}</dt>
                <dd className="whitespace-pre-line">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Objet
              <input
                value={info.title}
                maxLength={200}
                onChange={(e) => setInfo({ ...info, title: e.target.value })}
                placeholder="Rénovation salle de bain"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Client
              <input
                value={info.clientName}
                maxLength={200}
                autoComplete="off"
                onChange={(e) => setInfo({ ...info, clientName: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Adresse
              <textarea
                value={info.clientAddress}
                rows={3}
                maxLength={500}
                onChange={(e) => setInfo({ ...info, clientAddress: e.target.value })}
                className={`${inputClass} py-2`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Notes
              <textarea
                value={info.notes}
                rows={4}
                maxLength={5000}
                onChange={(e) => setInfo({ ...info, notes: e.target.value })}
                className={`${inputClass} py-2`}
              />
            </label>
          </>
        )}
      </section>

      <section aria-labelledby="lignes-titre" className="flex flex-col gap-3">
        <h2 id="lignes-titre" className="text-lg font-semibold">
          Lignes du devis
        </h2>
        {!readOnly && ai.hasMedia && (
          <AiPanel
            enabled={ai.enabled}
            running={aiRunning}
            hasLines={drafts.length > 0}
            disabled={busy}
            onRun={() => runAi()}
          />
        )}
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-600">
            Aucune ligne pour l&apos;instant.
            {!readOnly && " Ajoutez un poste depuis la grille ou une ligne hors grille."}
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {drafts.map((draft, index) => (
              <LineRow
                key={draft.key}
                draft={draft}
                index={index}
                count={drafts.length}
                errors={converted.errors[draft.key]}
                serverError={visibleMessage?.lineErrors?.[index]}
                readOnly={readOnly}
                onChange={(patch) => patchDraft(draft.key, patch)}
                onMove={(direction) => moveDraft(index, direction)}
                onRemove={() => removeDraft(index)}
              />
            ))}
          </ul>
        )}

        {!readOnly && (
          <>
            {removed && (
              <p role="status" className="flex items-center justify-between gap-3 text-sm text-stone-700">
                Ligne supprimée.
                <button type="button" onClick={undoRemove} className={`${secondaryButtonClass}`}>
                  Annuler
                </button>
              </p>
            )}
            {panel === "grid" ? (
              <GridPicker
                items={priceItems}
                onPick={(item) => addDraft(draftFromPriceItem(item, makeKey()))}
                onClose={() => setPanel(null)}
              />
            ) : panel === "free" ? (
              <div className="flex flex-col gap-3 rounded-xl border border-stone-300 bg-white p-3">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Libellé du travail
                  <input
                    autoFocus
                    value={freeLabel}
                    maxLength={300}
                    onChange={(e) => setFreeLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFreeLine();
                      }
                    }}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Unité
                  <select
                    value={freeUnit}
                    onChange={(e) => setFreeUnit(e.target.value as Unit)}
                    className={inputClass}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-stone-600">Le prix reste « à chiffrer » : saisissez-le ensuite.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addFreeLine}
                    disabled={freeLabel.trim() === ""}
                    className={`${primaryButtonClass} flex-1`}
                  >
                    Ajouter la ligne
                  </button>
                  <button type="button" onClick={() => setPanel(null)} className={secondaryButtonClass}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setPanel("grid")}
                  className={`${primaryButtonClass} flex-1`}
                >
                  Ajouter depuis la grille
                </button>
                <button
                  type="button"
                  onClick={() => setPanel("free")}
                  className={`${secondaryButtonClass} flex-1`}
                >
                  Ajouter une ligne hors grille
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section
        aria-labelledby="totaux-titre"
        className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <h2 id="totaux-titre" className="text-lg font-semibold">
          Totaux
        </h2>
        {totals ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-base tabular-nums">
            <dt>Sous-total HT</dt>
            <dd className="text-right" data-testid="sous-total">
              {formatChf(totals.subtotalCents)}
            </dd>
            <dt>TVA {(totals.vatRateBp / 100).toFixed(1).replace(".", ",")} %</dt>
            <dd className="text-right" data-testid="tva">
              {formatChf(totals.vatCents)}
            </dd>
            <dt>Arrondi aux 5 ct</dt>
            <dd className="text-right" data-testid="arrondi">
              {formatChf(totals.roundingCents)}
            </dd>
            <dt className="font-semibold">Total TTC</dt>
            <dd className="text-right font-semibold" data-testid="total-ttc">
              {formatChf(totals.totalCents)}
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-red-700">Total impossible à calculer : montants trop élevés.</p>
        )}
        {unpricedCount > 0 && (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {unpricedCount === 1
              ? "1 ligne est à chiffrer : le total est incomplet."
              : `${unpricedCount} lignes sont à chiffrer : le total est incomplet.`}
          </p>
        )}
        {converted.invalidCount > 0 && (
          <p role="status" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
            {converted.invalidCount === 1
              ? "1 ligne a une saisie invalide et n'est pas comptée dans le total."
              : `${converted.invalidCount} lignes ont une saisie invalide et ne sont pas comptées dans le total.`}
          </p>
        )}
        {!readOnly && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => changeStatus("valide")}
              disabled={busy || dirty}
              className={`${buttonClass} bg-emerald-700 text-white`}
            >
              Valider le devis
            </button>
            {dirty && (
              <p className="text-sm text-stone-600">Enregistrez vos modifications avant de valider.</p>
            )}
          </div>
        )}
        {readOnly && (
          <p className="text-sm text-stone-600">
            Ce devis est validé : il n&apos;est plus modifiable tant qu&apos;il n&apos;est pas repassé en brouillon.
          </p>
        )}
      </section>

      <div
        data-testid="barre"
        className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col gap-2 border-t border-stone-300 bg-white/95 px-4 py-3 backdrop-blur"
      >
        {aiRunning && (
          <p role="status" className="flex items-center gap-2 text-sm text-amber-950">
            <span aria-hidden="true" className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
            Analyse IA en cours (photos et note vocale)…
          </p>
        )}
        {visibleMessage && (
          <p
            role={visibleMessage.kind === "error" ? "alert" : "status"}
            className={`text-sm ${visibleMessage.kind === "error" ? "text-red-700" : "text-emerald-800"}`}
          >
            {visibleMessage.text}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-stone-500">
              Total TTC{unpricedCount > 0 ? " (incomplet)" : ""}
            </p>
            <p className="text-lg font-semibold tabular-nums" data-testid="barre-total">
              {total}
            </p>
            {dirty && !readOnly && (
              <p className="text-xs font-medium text-amber-800" data-testid="non-enregistre">
                Modifications non enregistrées
              </p>
            )}
          </div>
          {readOnly ? (
            <button
              type="button"
              onClick={() => changeStatus("brouillon")}
              disabled={busy}
              className={secondaryButtonClass}
            >
              Repasser en brouillon
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className={`${primaryButtonClass} min-w-32`}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function AiPanel({
  enabled,
  running,
  hasLines,
  disabled,
  onRun,
}: {
  enabled: boolean;
  running: boolean;
  hasLines: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  if (!enabled) {
    return (
      <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
        Brouillon IA indisponible : ajoutez <code>OPENROUTER_API_KEY</code> dans <code>.env.local</code> puis
        redémarrez le serveur.
      </p>
    );
  }
  if (running) {
    return (
      <p className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
        <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
        Analyse de la note vocale et des photos… environ 15 secondes.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className={hasLines ? secondaryButtonClass : primaryButtonClass}
      >
        {hasLines ? "Relancer l'IA" : "Proposer les lignes avec l'IA"}
      </button>
      <p className="text-xs text-stone-600">
        L&apos;IA choisit les postes et les quantités ; les prix viennent toujours de la grille.
      </p>
    </div>
  );
}
