import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { listPriceItems } from "@/db/price-items";
import { getQuote } from "@/db/quotes";
import { Editor } from "./editor";
import { formatDateCh } from "@/lib/format-date";
import { MediaSection } from "./media-section";

export const metadata: Metadata = { title: "Relecture du devis · Devis chantier" };

export default function QuotePage({ params }: PageProps<"/devis/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6">
      <Suspense fallback={<p className="pb-8 text-stone-500">Chargement du devis…</p>}>
        <QuoteScreen params={params} />
      </Suspense>
    </main>
  );
}

async function QuoteScreen({ params }: Pick<PageProps<"/devis/[id]">, "params">) {
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);
  await connection();
  const db = getDb();
  const quote = getQuote(db, id);
  if (!quote) notFound();
  const priceItems = listPriceItems(db);

  return (
    <Editor
      quote={{
        id: quote.id,
        number: quote.number,
        createdAtLabel: formatDateCh(quote.createdAt),
        status: quote.status,
        info: {
          title: quote.title,
          clientName: quote.clientName,
          clientAddress: quote.clientAddress,
          notes: quote.notes,
        },
        lines: quote.lines,
      }}
      priceItems={priceItems}
      media={<MediaSection quoteId={quote.id} media={quote.media} />}
    />
  );
}
