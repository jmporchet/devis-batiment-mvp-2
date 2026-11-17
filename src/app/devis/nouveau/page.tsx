import type { Metadata } from "next";
import Link from "next/link";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = { title: "Nouveau devis · Devis chantier" };

export default function NouveauDevisPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Link href="/devis" className="inline-flex min-h-11 items-center text-sm text-stone-600 underline">
          Devis
        </Link>
        <h1 className="text-2xl font-semibold">Nouveau devis</h1>
        <p className="mt-1 text-sm text-stone-600">
          Photographiez le chantier et dictez ce qu&apos;il y a à faire.
        </p>
      </header>
      <CaptureForm />
    </main>
  );
}
