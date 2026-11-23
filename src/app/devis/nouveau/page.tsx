import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = { title: "Nouveau devis · Devis chantier" };

export default function NouveauDevisPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Breadcrumbs
          items={[
            { href: "/", label: "Accueil" },
            { href: "/devis", label: "Devis" },
            { href: "/devis/nouveau", label: "Nouveau devis" },
          ]}
        />
        <h1 id="titre-nouveau-devis" className="text-2xl font-semibold">Nouveau devis</h1>
        <p className="mt-1 text-stone-700">
          Photographiez le chantier et dictez ce qu&apos;il y a à faire.
        </p>
      </header>
      <CaptureForm />
    </main>
  );
}
