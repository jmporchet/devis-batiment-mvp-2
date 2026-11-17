import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Devis chantier</h1>
        <p className="mt-1 text-stone-600">
          Photos et notes vocales, devis structuré en quelques minutes.
        </p>
      </header>
      <nav>
        <Link
          href="/grille"
          className="flex min-h-11 items-center justify-between rounded-xl border border-stone-200 bg-white px-4 text-base font-medium"
        >
          Grille de prix
          <span aria-hidden="true">›</span>
        </Link>
      </nav>
    </main>
  );
}
