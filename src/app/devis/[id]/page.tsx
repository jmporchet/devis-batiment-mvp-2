import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getQuote } from "@/db/quotes";

export const metadata: Metadata = { title: "Devis · Devis chantier" };

/** Page provisoire : remplacée par l'écran de relecture. */
export default function QuotePage({ params }: PageProps<"/devis/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/devis" className="inline-flex min-h-11 items-center text-sm text-stone-600 underline">
        Retour aux devis
      </Link>
      <Suspense fallback={<p className="text-stone-500">Chargement du devis…</p>}>
        <QuoteContent params={params} />
      </Suspense>
    </main>
  );
}

async function QuoteContent({ params }: { params: PageProps<"/devis/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const quoteId = Number(id);
  const quote = Number.isInteger(quoteId) ? getQuote(getDb(), quoteId) : undefined;
  if (!quote) notFound();

  const photos = quote.media.filter((m) => m.kind === "photo");
  const audio = quote.media.find((m) => m.kind === "audio");

  return (
    <>
      <header>
        <p className="text-sm text-stone-500">Devis N° {quote.number}</p>
        <h1 className={`break-words text-2xl font-semibold ${quote.title ? "" : "text-stone-500"}`}>
          {quote.title || "Sans objet"}
        </h1>
      </header>
      {photos.length > 0 ? (
        <section aria-label="Photos" className="flex flex-col gap-3">
          {photos.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={`/devis/${quote.id}/media/${photo.id}`}
              alt={`Photo ${index + 1} du chantier`}
              className="w-full rounded-xl bg-stone-200"
            />
          ))}
        </section>
      ) : null}
      {audio ? (
        <section aria-label="Note vocale" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Note vocale</h2>
          <audio controls preload="metadata" src={`/devis/${quote.id}/media/${audio.id}`} className="w-full" />
        </section>
      ) : null}
    </>
  );
}
