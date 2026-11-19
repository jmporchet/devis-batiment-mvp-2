import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { listPriceItems } from "@/db/price-items";
import { getQuote } from "@/db/quotes";
import { isAiConfigured } from "@/server/ai/openrouter";
import { Editor } from "./editor";
import { formatDateCh } from "@/lib/format-date";
import { MediaSection } from "./media-section";

export const metadata: Metadata = { title: "Relecture du devis · Devis chantier" };

export default function QuotePage({ params, searchParams }: PageProps<"/devis/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6">
      <Suspense fallback={<p className="pb-8 text-stone-500">Chargement du devis…</p>}>
        <QuoteScreen params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function QuoteScreen({
  params,
  searchParams,
}: Pick<PageProps<"/devis/[id]">, "params" | "searchParams">) {
  const { id: rawId } = await params;
  const { ia } = await searchParams;
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
        photoCount: quote.media.filter((m) => m.kind === "photo").length,
        hasAudio: quote.media.some((m) => m.kind === "audio"),
        info: {
          title: quote.title,
          clientName: quote.clientName,
          clientAddress: quote.clientAddress,
          notes: quote.notes,
        },
        lines: quote.lines,
      }}
      priceItems={priceItems}
      ai={{
        enabled: isAiConfigured(),
        hasMedia: quote.media.length > 0,
        // Arrivée depuis la capture (?ia=1) : lancer l'analyse tout de suite.
        autoStart: ia === "1" && quote.lines.length === 0 && quote.status === "brouillon",
      }}
      media={<MediaSection quoteId={quote.id} media={quote.media} />}
    />
  );
}
