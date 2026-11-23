import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getCompany } from "@/db/company";
import { DEMO_COMPANY } from "@/domain/types";
import { FIELDS, type CompanyFormState } from "./action-state";
import { CompanyForm } from "./company-form";
import { LogoSection } from "./logo-section";

export const metadata: Metadata = { title: "Mon entreprise · Devis chantier" };

export default function EntreprisePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <Breadcrumbs
          items={[
            { href: "/", label: "Accueil" },
            { href: "/entreprise", label: "Mon entreprise" },
          ]}
        />
        <h1 className="text-2xl font-semibold">Mon entreprise</h1>
        <p className="mt-1 text-sm text-stone-600">
          Ces coordonnées apparaissent en en-tête et en pied des devis PDF.
        </p>
      </header>
      <Suspense fallback={<p className="text-stone-500">Chargement des coordonnées…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await connection();
  const company = getCompany(getDb());
  const initial: CompanyFormState = {
    ok: false,
    message: "",
    fieldErrors: {},
    values: Object.fromEntries(FIELDS.map((f) => [f, String(company[f])])) as CompanyFormState["values"],
    at: 0,
  };

  return (
    <>
      {company.name === DEMO_COMPANY.name && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Coordonnées de démonstration : remplacez-les avant d&apos;envoyer un devis à un client.
        </p>
      )}
      <CompanyForm initial={initial} />
      <LogoSection hasLogo={company.hasLogo} version={company.updatedAt.getTime()} />
    </>
  );
}
