import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listPriceItems, suggestNextCode } from "@/db/price-items";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/domain/types";
import { AddItemForm } from "./add-item-form";
import { PriceItemRow } from "./price-item-row";

export const metadata: Metadata = { title: "Grille de prix · Devis chantier" };

export default function GrillePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-stone-600 underline">
          Accueil
        </Link>
        <h1 className="text-2xl font-semibold">Grille de prix</h1>
        <p className="mt-1 text-sm text-stone-600">
          Prix unitaires HT en CHF. Seuls les postes actifs sont proposés pour les devis.
        </p>
      </header>
      <Suspense fallback={<p className="text-stone-500">Chargement de la grille…</p>}>
        <Grid />
      </Suspense>
    </main>
  );
}

async function Grid() {
  await connection();
  const db = getDb();
  const items = listPriceItems(db, { includeInactive: true });
  const suggestedCodes = Object.fromEntries(
    CATEGORIES.map((c) => [c, suggestNextCode(db, c)]),
  ) as Record<Category, string>;

  return (
    <>
      <AddItemForm key={Object.values(suggestedCodes).join()} suggestedCodes={suggestedCodes} />
      {CATEGORIES.map((category) => {
        const group = items.filter((i) => i.category === category);
        if (group.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`} className="text-lg font-semibold">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="mt-1 divide-y divide-stone-200 border-y border-stone-200">
              {group.map((item) => (
                <PriceItemRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
