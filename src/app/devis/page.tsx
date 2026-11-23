import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getDb } from "@/db/client";
import { listQuotes } from "@/db/quotes";
import { formatChf } from "@/domain/money";
import { QUOTE_STATUS_LABELS, type QuoteStatus, type QuoteSummary } from "@/domain/types";
import { formatDateCh } from "@/lib/format-date";

export const metadata: Metadata = { title: "Devis · Devis chantier" };

const newQuoteClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-900 px-5 text-base font-semibold text-white active:bg-stone-700";

const STATUS_CLASS: Record<QuoteStatus, string> = {
  brouillon: "bg-amber-100 text-amber-900",
  valide: "bg-emerald-100 text-emerald-900",
};

export default function DevisPage({ searchParams }: PageProps<"/devis">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header>
        <Breadcrumbs
          items={[
            { href: "/", label: "Accueil" },
            { href: "/devis", label: "Devis" },
          ]}
        />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Devis</h1>
          <Link href="/devis/nouveau" className={newQuoteClass}>
            Nouveau devis
          </Link>
        </div>
        <div role="status" className="not-empty:mt-3">
          <Suspense fallback={null}>
            <DeletedNotice searchParams={searchParams} />
          </Suspense>
        </div>
      </header>
      <Suspense fallback={<p className="text-stone-500">Chargement des devis…</p>}>
        <QuoteList />
      </Suspense>
    </main>
  );
}

/** Confirmation après la suppression d'un brouillon (?supprime=2026-003). */
async function DeletedNotice({ searchParams }: Pick<PageProps<"/devis">, "searchParams">) {
  const { supprime } = await searchParams;
  if (typeof supprime !== "string" || !/^\d{4}-\d{3,}$/.test(supprime)) return null;
  return <p className="rounded-lg bg-stone-200 p-3 text-sm text-stone-900">Devis {supprime} supprimé.</p>;
}

async function QuoteList() {
  await connection();
  const quotes = listQuotes(getDb());

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
        <p className="text-stone-600">Aucun devis pour l&apos;instant.</p>
        <Link href="/devis/nouveau" className={newQuoteClass}>
          Nouveau devis
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {quotes.map((quote) => (
        <li key={quote.id}>
          <QuoteCard quote={quote} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Carte d'un devis : <article> avec un titre. Le texte de la carte est long,
 * donc seul le titre est un lien ; son ::after étire la zone cliquable sur
 * toute la carte (lien étiré). Aucun autre élément interactif dans la carte.
 */
function QuoteCard({ quote }: { quote: QuoteSummary }) {
  const { totals } = quote;
  return (
    <article className="relative flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 has-[a:active]:bg-stone-100 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-stone-600">
            N° {quote.number} · {formatDateCh(quote.createdAt)}
          </p>
          <h2 className={`break-words text-base font-semibold ${quote.title ? "" : "text-stone-600"}`}>
            <Link
              href={`/devis/${quote.id}`}
              className="inline-flex min-h-(--target-size) items-center after:absolute after:inset-0 focus-visible:outline-none"
            >
              {quote.title || "Sans objet"}
              <span className="visually-hidden"> (devis n° {quote.number})</span>
            </Link>
          </h2>
          {quote.clientName ? <p className="break-words text-sm text-stone-600">{quote.clientName}</p> : null}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[quote.status]}`}>
          {QUOTE_STATUS_LABELS[quote.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-base font-semibold tabular-nums">
          {quote.lineCount === 0 ? (
            <span className="font-normal text-stone-600">Pas encore chiffré</span>
          ) : (
            <>
              {formatChf(totals.totalCents)} <span className="text-xs font-normal text-stone-600">TTC</span>
              {totals.hasUnpricedLines ? (
                <span className="ml-2 text-xs font-medium text-amber-800">incomplet</span>
              ) : null}
            </>
          )}
        </p>
        <p className="text-xs text-stone-600">
          {quote.lineCount} {quote.lineCount > 1 ? "lignes" : "ligne"} · {quote.photoCount}{" "}
          {quote.photoCount > 1 ? "photos" : "photo"} · {quote.hasAudio ? "note vocale" : "sans note vocale"}
        </p>
      </div>
    </article>
  );
}
