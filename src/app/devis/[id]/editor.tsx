"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Field } from "@/components/field";
import { useConfirm } from "@/components/confirm-dialog";
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
} from "@/domain/types";
import type { ActionResult } from "./action-result";
import { deleteDraftAction, generateDraftAction, saveInfoAction, saveLinesAction, setStatusAction } from "./actions";
import { ErrorIcon } from "@/components/field";
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
import { buttonClass, primaryButtonClass, secondaryButtonClass } from "./ui";

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
  /** Pour le message de confirmation de suppression. */
  photoCount: number;
  hasAudio: boolean;
}

interface Message {
  kind: "ok" | "error";
  text: string;
  /** Erreurs par numéro de ligne (0 = première), renvoyées par le serveur. */
  lineErrors?: Record<number, string>;
  /** Le message disparaît dès que le contenu change. */
  at: string;
}

/** Identifie un contenu : un message n'est valable que pour lui. */
function contentIdOf(drafts: LineDraft[], info: QuoteInfo): string {
  return `${draftsSignature(drafts)}|${JSON.stringify(info)}`;
}

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
  const router = useRouter();
  const [confirmDialog, confirm] = useConfirm();
  // Ids propres à cet éditeur : une page déjà visitée peut rester dans le DOM (masquée).
  const uid = useId();
  const eid = (name: string) => `${uid}-${name}`;
  const lineId = (key: string, field: string) => lineFieldId(`${uid}-${key}`, field);

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
  /** Lignes dont les erreurs de saisie sont affichées d'emblée (après un enregistrement refusé). */
  const [attempted, setAttempted] = useState<string[]>([]);
  /** Éléments à focaliser après le prochain rendu : le premier qui existe et n'est pas désactivé. */
  const focusRequest = useRef<string[] | null>(null);
  const [, setFocusTick] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  /** Départ confirmé : l'avertissement du navigateur ne doit plus s'ajouter à la boîte déjà acceptée. */
  const leaving = useRef(false);

  function requestFocus(...ids: string[]) {
    focusRequest.current = ids;
    setFocusTick((tick) => tick + 1);
  }

  const readOnly = status === "valide";
  const signature = draftsSignature(drafts);
  const infoDirty = JSON.stringify(info) !== JSON.stringify(savedInfo);
  const linesDirty = signature !== savedSignature;
  const dirty = infoDirty || linesDirty;
  const contentId = contentIdOf(drafts, info);
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

  // Focus demandé après un ajout, un déplacement, une suppression ou une erreur.
  useEffect(() => {
    const ids = focusRequest.current;
    if (!ids) return;
    focusRequest.current = null;
    for (const id of ids) {
      const element = document.getElementById(id);
      if (!element || (element as HTMLButtonElement).disabled || element.getAttribute("aria-disabled") === "true") {
        continue;
      }
      element.focus();
      return;
    }
  });

  // Après un brouillon IA, amène le chef de chantier sur les lignes proposées.
  useEffect(() => {
    if (!scrollToLines.current) return;
    scrollToLines.current = false;
    document.getElementById(eid("lignes-titre"))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // La barre collante ne doit jamais masquer le champ qui prend le focus.
  // 1. scroll-padding-bottom suit la hauteur réelle de la barre (elle grandit avec
  //    la taille de texte du système et avec un message long) via une variable CSS.
  // 2. Le navigateur ne fait pas défiler un champ déjà entièrement dans la fenêtre,
  //    même s'il passe sous la barre, ou sous le clavier virtuel : on le remonte.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const update = () => {
      // Hauteur réelle de la barre, lue par scroll-padding-bottom dans globals.css.
      root.style.setProperty("--sticky-bar-block-size", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);

    const reveal = (element: Element | null) => {
      if (!(element instanceof HTMLElement) || bar.contains(element) || !element.matches("input, textarea, select, button, summary, a")) {
        return;
      }
      const viewport = window.visualViewport;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const limit = Math.min(bar.getBoundingClientRect().top, visibleBottom) - 8;
      const bottom = element.getBoundingClientRect().bottom;
      if (bottom > limit) window.scrollBy({ top: bottom - limit });
    };
    const onFocusIn = (event: FocusEvent) => requestAnimationFrame(() => reveal(event.target as Element));
    // Le clavier virtuel se déploie après le focus : le viewport visuel se réduit alors.
    const onViewportResize = () => reveal(document.activeElement);
    document.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      root.style.removeProperty("--sticky-bar-block-size");
    };
  }, []);

  // Avertit avant de quitter la page tant que des modifications ne sont pas enregistrées :
  // beforeunload pour un rechargement ou une fermeture d'onglet…
  useEffect(() => {
    if (!dirty || readOnly) return;
    leaving.current = false;
    const handler = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, readOnly]);

  // … et confirmation dans la page pour les liens internes (fil d'Ariane, accueil…),
  // interceptés en capture avant que le routeur ne les traite.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      void confirm({
        title: "Quitter sans enregistrer ?",
        message: "Les modifications non enregistrées de ce devis seront perdues.",
        confirmLabel: "Quitter sans enregistrer",
        cancelLabel: "Rester sur la page",
        destructive: true,
      }).then((ok) => {
        if (!ok) return;
        leaving.current = true;
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, readOnly, confirm, router]);

  function patchDraft(key: string, patch: Partial<LineDraft>) {
    setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function addDraft(draft: LineDraft) {
    requestFocus(lineId(draft.key, "quantity"));
    setDrafts((current) => [...current, draft]);
    setRemoved(null);
    setPanel(null);
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const key = drafts[index].key;
    const next = moveItem(drafts, index, direction);
    // En bout de liste, le bouton utilisé devient inactif : le focus passe à l'autre.
    requestFocus(
      lineId(key, direction === -1 ? "up" : "down"),
      lineId(key, direction === -1 ? "down" : "up"),
    );
    setDrafts(next);
    setMessage({
      kind: "ok",
      text: `Ligne ${index + 1} déplacée en position ${index + 1 + direction}.`,
      at: contentIdOf(next, info),
    });
  }

  function removeDraft(index: number) {
    const next = drafts.filter((_, i) => i !== index);
    setRemoved({ draft: drafts[index], index });
    setDrafts(next);
    setMessage({ kind: "ok", text: `Ligne ${index + 1} supprimée.`, at: contentIdOf(next, info) });
    requestFocus(eid("annuler-suppression"));
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
    requestFocus(lineId(draft.key, "quantity"));
  }

  function fail(result: Extract<ActionResult, { ok: false }>) {
    const lineErrors = lineErrorsFrom(result.fieldErrors);
    setMessage({ kind: "error", text: result.message, lineErrors, at: contentId });
    // Le focus va à la première ligne refusée par le serveur.
    const first = Object.keys(lineErrors).map(Number).sort((a, b) => a - b)[0];
    if (first !== undefined && drafts[first]) requestFocus(lineId(drafts[first].key, "server-error"));
  }

  async function save(): Promise<boolean> {
    if (busy || readOnly) return false;
    if (!dirty) {
      setMessage({ kind: "ok", text: "Aucune modification à enregistrer.", at: contentId });
      return false;
    }
    if (converted.lines === null) {
      const invalid = drafts.filter((d) => converted.errors[d.key]);
      setAttempted(invalid.map((d) => d.key));
      setMessage({
        kind: "error",
        text:
          converted.invalidCount === 1
            ? "Une ligne contient une saisie invalide : corrigez-la pour enregistrer."
            : `${converted.invalidCount} lignes contiennent une saisie invalide : corrigez-les pour enregistrer.`,
        at: contentId,
      });
      // Focus sur le premier champ en erreur, dont le message est alors annoncé.
      const errors = converted.errors[invalid[0].key];
      requestFocus(lineId(invalid[0].key, errors.label ? "label" : errors.quantity ? "quantity" : "price"));
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
      setAttempted([]);
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
    if (next === "valide" && dirty) {
      setMessage({ kind: "error", text: "Enregistrez vos modifications avant de valider le devis.", at: contentId });
      return;
    }
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
      // Le bouton utilisé disparaît avec le changement de mode : le focus passe à son pendant.
      requestFocus(eid(result.status === "valide" ? "repasser-brouillon" : "valider-devis"));
    } catch (error) {
      console.error(error);
      setMessage({ kind: "error", text: SAVE_ERROR, at: contentId });
    } finally {
      setBusy(false);
    }
  }

  /** Suppression définitive d'un brouillon (la liste s'ouvre ensuite). */
  async function deleteDraft() {
    if (busy || readOnly) return;
    const attached = [
      quote.photoCount === 1 ? "sa photo" : quote.photoCount > 1 ? `ses ${quote.photoCount} photos` : "",
      quote.hasAudio ? "sa note vocale" : "",
    ].filter(Boolean);
    const ok = await confirm({
      title: `Supprimer le devis ${quote.number} ?`,
      message:
        `Le devis ${quote.number}${attached.length > 0 ? ` avec ${attached.join(" et ")}` : ""} ` +
        "sera supprimé définitivement. Cette action est irréversible.",
      confirmLabel: "Supprimer le devis",
      cancelLabel: "Conserver le devis",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      // En cas de succès, l'action redirige vers /devis et ne renvoie rien.
      const result = await deleteDraftAction(quote.id);
      if (result && !result.ok) fail(result);
    } finally {
      setBusy(false);
    }
  }

  /** Brouillon IA : remplace les lignes par la proposition du modèle. */
  async function runAi(options: { confirm: boolean } = { confirm: true }) {
    if (busy || readOnly) return;
    // Sans confirmation (lancement automatique depuis un effet), aucun `await` ne
    // précède startAi : la transition démarre dans le même tour.
    if (options.confirm && (dirty || drafts.length > 0)) {
      const consequences = [
        dirty ? "Vos modifications non enregistrées seront perdues." : "",
        drafts.length > 0
          ? `Les ${drafts.length} ligne${drafts.length > 1 ? "s" : ""} actuelle${drafts.length > 1 ? "s" : ""} seront remplacées par la proposition de l'IA.`
          : "",
      ].filter(Boolean);
      const ok = await confirm({
        title: "Relancer l'analyse IA ?",
        message: consequences.join(" "),
        confirmLabel: "Relancer l'IA",
        cancelLabel: "Garder mes lignes",
        destructive: true,
      });
      if (!ok) return;
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
        setAttempted([]);
        setInfo(result.info);
        setSavedInfo(result.info);
        const unpriced = result.lines.filter((l) => l.unitPriceCents === null).length;
        setMessage({
          kind: "ok",
          text:
            `L'IA propose ${result.lines.length} ligne${result.lines.length > 1 ? "s" : ""}` +
            (unpriced > 0 ? `, dont ${unpriced} à chiffrer` : "") +
            ". Vérifiez les quantités et les points « À vérifier » dans les notes.",
          at: contentIdOf(next, result.info),
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
    void runAi({ confirm: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lancement unique au montage
  }, []);

  function addFreeLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("label") ?? "");
    const unit = UNITS.find((u) => u === data.get("unit")) ?? "forfait";
    if (label.trim() === "") return;
    addDraft(draftOffGrid(label, unit, makeKey()));
    form.reset();
  }

  const total = totals ? formatChf(totals.totalCents) : "—";
  const statusKind = aiRunning ? "running" : (visibleMessage?.kind ?? null);

  const infosSection = (
    <section aria-labelledby={eid("infos-titre")} className="flex flex-col gap-3">
      <h2 id={eid("infos-titre")} className="text-lg font-semibold">
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
              <dt className="text-sm font-medium text-stone-700">{label}</dt>
              <dd className="whitespace-pre-line">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <Field
            name="objet"
            label="Objet"
            hint="Par exemple : rénovation de salle de bain."
            error="Saisissez 200 caractères au maximum."
          >
            {(control) => (
              <input
                {...control}
                type="text"
                value={info.title}
                maxLength={200}
                autoComplete="off"
                enterKeyHint="next"
                onChange={(e) => setInfo({ ...info, title: e.target.value })}
              />
            )}
          </Field>
          <Field name="client" label="Client" error="Saisissez 200 caractères au maximum.">
            {(control) => (
              <input
                {...control}
                type="text"
                value={info.clientName}
                maxLength={200}
                autoComplete="name"
                enterKeyHint="next"
                onChange={(e) => setInfo({ ...info, clientName: e.target.value })}
              />
            )}
          </Field>
          <Field name="adresse" label="Adresse" error="Saisissez 500 caractères au maximum.">
            {(control) => (
              <textarea
                {...control}
                value={info.clientAddress}
                rows={3}
                maxLength={500}
                autoComplete="street-address"
                onChange={(e) => setInfo({ ...info, clientAddress: e.target.value })}
                className={`${control.className} py-2`}
              />
            )}
          </Field>
          <Field name="notes" label="Notes" error="Saisissez 5 000 caractères au maximum.">
            {(control) => (
              <textarea
                {...control}
                value={info.notes}
                rows={4}
                maxLength={5000}
                autoComplete="off"
                onChange={(e) => setInfo({ ...info, notes: e.target.value })}
                className={`${control.className} py-2`}
              />
            )}
          </Field>
        </>
      )}
    </section>
  );

  const linesSection = (
    <section aria-labelledby={eid("lignes-titre")} className="flex flex-col gap-3">
      <h2 id={eid("lignes-titre")} className="text-lg font-semibold">
        Lignes du devis
      </h2>
      {!readOnly && ai.hasMedia && (
        <AiPanel
          enabled={ai.enabled}
          running={aiRunning}
          hasLines={drafts.length > 0}
          busy={busy}
          onRun={() => void runAi()}
        />
      )}
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-400 p-4 text-sm text-stone-700">
          Aucune ligne pour l&apos;instant.
          {!readOnly && " Ajoutez un poste depuis la grille ou une ligne hors grille."}
        </p>
      ) : (
        <ol aria-labelledby={eid("lignes-titre")} className="divide-y divide-stone-200 border-y border-stone-200">
          {drafts.map((draft, index) => (
            <LineRow
              key={draft.key}
              draft={{ ...draft, key: `${uid}-${draft.key}` }}
              index={index}
              count={drafts.length}
              errors={converted.errors[draft.key]}
              serverError={visibleMessage?.lineErrors?.[index]}
              readOnly={readOnly}
              showErrors={attempted.includes(draft.key)}
              onInvalidBlur={(text) => setMessage({ kind: "error", text, at: contentId })}
              onChange={(patch) => patchDraft(draft.key, patch)}
              onMove={(direction) => moveDraft(index, direction)}
              onRemove={() => removeDraft(index)}
            />
          ))}
        </ol>
      )}
      {!readOnly && removed && (
        <p className="flex items-center justify-between gap-3 text-sm text-stone-800">
          Ligne supprimée.
          <button type="button" id={eid("annuler-suppression")} onClick={undoRemove} className={secondaryButtonClass}>
            Annuler la suppression
          </button>
        </p>
      )}
    </section>
  );

  return (
    <>
      <header className="flex flex-col gap-1">
        <Breadcrumbs
          items={[
            { href: "/", label: "Accueil" },
            { href: "/devis", label: "Devis" },
            { href: `/devis/${quote.id}`, label: `Devis ${quote.number}` },
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 id={eid("titre")} className="text-2xl font-semibold">
            Devis {quote.number}
          </h1>
          <span
            data-testid="statut"
            className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
              readOnly ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-800"
            }`}
          >
            {QUOTE_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-sm text-stone-700">Créé le {quote.createdAtLabel}</p>
        <div className="flex flex-col gap-1">
          {/* Nouvel onglet : la relecture reste ouverte, rien à confirmer. */}
          <a
            href={`/devis/${quote.id}/pdf`}
            target="_blank"
            rel="noopener"
            className={`${secondaryButtonClass} self-start`}
          >
            Voir le PDF
            <span className="visually-hidden"> (s&apos;ouvre dans un nouvel onglet)</span>
          </a>
          {dirty && !readOnly && (
            <p className="text-sm text-amber-900" data-testid="pdf-avertissement">
              Le PDF reflète la dernière version enregistrée, sans vos modifications en cours.
            </p>
          )}
        </div>
      </header>

      {media}

      {readOnly ? (
        <>
          {infosSection}
          {linesSection}
        </>
      ) : (
        <form
          id={eid("edition")}
          aria-labelledby={eid("titre")}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col gap-6"
        >
          {infosSection}
          {linesSection}
        </form>
      )}

      {!readOnly && (
        <section aria-labelledby={eid("ajout-titre")} className="flex flex-col gap-3">
          <h2 id={eid("ajout-titre")} className="text-lg font-semibold">
            Ajouter une ligne
          </h2>
          <details
            open={panel === "grid"}
            onToggle={(e) => {
              const open = e.currentTarget.open;
              setPanel((current) => (open ? "grid" : current === "grid" ? null : current));
            }}
            className="rounded-xl border border-stone-500 bg-white"
          >
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">
              Ajouter depuis la grille
            </summary>
            {panel === "grid" && (
              <GridPicker items={priceItems} onPick={(item) => addDraft(draftFromPriceItem(item, makeKey()))} />
            )}
          </details>
          <details
            open={panel === "free"}
            onToggle={(e) => {
              const open = e.currentTarget.open;
              setPanel((current) => (open ? "free" : current === "free" ? null : current));
            }}
            className="rounded-xl border border-stone-500 bg-white"
          >
            <summary id={eid("hors-grille")} className="flex min-h-12 cursor-pointer items-center px-4 font-medium">
              Ajouter une ligne hors grille
            </summary>
            {panel === "free" && (
              <form
                aria-labelledby={eid("hors-grille")}
                onSubmit={addFreeLine}
                className="flex flex-col gap-3 border-t border-stone-200 p-3"
              >
                <Field
                  name="label"
                  label="Libellé du travail"
                  required
                  error="Saisissez le libellé du travail, par exemple « Pose de plinthes »."
                >
                  {(control) => (
                    <input
                      {...control}
                      type="text"
                      autoFocus
                      pattern=".*\S.*"
                      maxLength={300}
                      autoComplete="off"
                      enterKeyHint="done"
                    />
                  )}
                </Field>
                <Field name="unit" label="Unité" error="Choisissez une unité.">
                  {(control) => (
                    <select {...control} defaultValue="forfait">
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABELS[u]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <p className="text-sm text-stone-700">Le prix reste « à chiffrer » : saisissez-le ensuite.</p>
                <button type="submit" className={primaryButtonClass}>
                  Ajouter la ligne
                </button>
              </form>
            )}
          </details>
        </section>
      )}

      <section
        aria-labelledby={eid("totaux-titre")}
        className="flex flex-col gap-3 rounded-xl border border-stone-300 bg-white p-4"
      >
        <h2 id={eid("totaux-titre")} className="text-lg font-semibold">
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
          <p className="flex items-start gap-1 text-sm text-red-700">
            <ErrorIcon />
            Total impossible à calculer : montants trop élevés. Vérifiez les quantités et les prix.
          </p>
        )}
        {unpricedCount > 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {unpricedCount === 1
              ? "1 ligne est à chiffrer : le total est incomplet."
              : `${unpricedCount} lignes sont à chiffrer : le total est incomplet.`}
          </p>
        )}
        {converted.invalidCount > 0 && (
          <p className="flex items-start gap-1 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            <ErrorIcon />
            {converted.invalidCount === 1
              ? "1 ligne a une saisie invalide et n'est pas comptée dans le total : corrigez-la."
              : `${converted.invalidCount} lignes ont une saisie invalide et ne sont pas comptées dans le total : corrigez-les.`}
          </p>
        )}
        {!readOnly && (
          <form
            aria-labelledby={eid("totaux-titre")}
            onSubmit={(event) => {
              event.preventDefault();
              void changeStatus("valide");
            }}
            className="flex flex-col gap-2"
          >
            <button
              type="submit"
              id={eid("valider-devis")}
              aria-disabled={busy || dirty}
              aria-describedby={dirty ? eid("valider-aide") : undefined}
              className={`${buttonClass} bg-emerald-800 text-white`}
            >
              Valider le devis
            </button>
            {dirty && (
              <p id={eid("valider-aide")} className="text-sm text-stone-700">
                Enregistrez vos modifications avant de valider.
              </p>
            )}
          </form>
        )}
        {readOnly && (
          <p className="text-sm text-stone-700">
            Ce devis est validé : il n&apos;est plus modifiable tant qu&apos;il n&apos;est pas repassé en brouillon.
          </p>
        )}
      </section>

      {!readOnly && (
        <section aria-labelledby={eid("suppression-titre")} className="flex flex-col gap-2 border-t border-stone-300 pt-5">
          <h2 id={eid("suppression-titre")} className="text-base font-semibold">
            Supprimer ce brouillon
          </h2>
          <p className="text-sm text-stone-700">
            Le devis, ses lignes, ses photos et sa note vocale seront effacés définitivement.
          </p>
          <form
            aria-labelledby={eid("suppression-titre")}
            onSubmit={(event) => {
              event.preventDefault();
              void deleteDraft();
            }}
          >
            <button
              type="submit"
              aria-disabled={busy}
              className={`${buttonClass} w-full border border-red-700 bg-white text-red-800 active:bg-red-50`}
            >
              Supprimer le brouillon
            </button>
          </form>
        </section>
      )}

      <div
        ref={barRef}
        data-testid="barre"
        className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col border-t border-stone-500 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        {/* Région de statut unique, toujours rendue : seul son texte change (annoncé de façon fiable). */}
        <p
          role="status"
          data-testid="statut-global"
          className={`flex items-start gap-2 text-sm not-empty:pb-2 ${
            statusKind === "error" ? "text-red-800" : statusKind === "running" ? "text-amber-950" : "text-emerald-900"
          }`}
        >
          {statusKind === "running" && (
            <>
              <span
                aria-hidden="true"
                className="mt-1 size-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-700 border-t-transparent"
              />
              Analyse IA en cours (photos et note vocale)…
            </>
          )}
          {statusKind === "error" && <ErrorIcon />}
          {statusKind !== "running" && visibleMessage?.text}
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-stone-700">Total TTC{unpricedCount > 0 ? " (incomplet)" : ""}</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="barre-total">
              {total}
            </p>
            {dirty && !readOnly && (
              <p className="text-xs font-medium text-amber-900" data-testid="non-enregistre">
                Modifications non enregistrées
              </p>
            )}
          </div>
          {readOnly ? (
            <form
              aria-label="Statut du devis"
              onSubmit={(event) => {
                event.preventDefault();
                void changeStatus("brouillon");
              }}
            >
              <button
                type="submit"
                id={eid("repasser-brouillon")}
                aria-disabled={busy}
                className={secondaryButtonClass}
              >
                Repasser en brouillon
              </button>
            </form>
          ) : (
            <button
              type="submit"
              form={eid("edition")}
              aria-disabled={busy || !dirty}
              className={`${primaryButtonClass} min-w-32`}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          )}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}

function AiPanel({
  enabled,
  running,
  hasLines,
  busy,
  onRun,
}: {
  enabled: boolean;
  running: boolean;
  hasLines: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  if (!enabled) {
    return (
      <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-800">
        Brouillon IA indisponible : ajoutez <code>OPENROUTER_API_KEY</code> dans <code>.env.local</code> puis
        redémarrez le serveur.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {/* Le bouton reste en place pendant l'analyse : le clavier ne perd pas le focus. */}
      <button
        type="button"
        onClick={onRun}
        aria-disabled={busy}
        className={hasLines ? secondaryButtonClass : primaryButtonClass}
      >
        {hasLines ? "Relancer l'IA" : "Proposer les lignes avec l'IA"}
      </button>
      {running ? (
        <p className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-amber-700 border-t-transparent"
          />
          Analyse de la note vocale et des photos… environ 15 secondes.
        </p>
      ) : (
        <p className="text-xs text-stone-700">
          L&apos;IA choisit les postes et les quantités ; les prix viennent toujours de la grille.
        </p>
      )}
    </div>
  );
}
