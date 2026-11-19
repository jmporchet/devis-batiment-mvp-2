import Link from "next/link";

const linkClass =
  "flex min-h-11 items-center justify-between rounded-xl border border-stone-200 bg-white px-4 text-base font-medium";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Devis chantier</h1>
        <p className="mt-1 text-stone-600">
          Photos et notes vocales, devis structuré en quelques minutes.
        </p>
      </header>
      <Link
        href="/devis/nouveau"
        className="flex min-h-16 items-center justify-center rounded-xl bg-stone-900 px-4 text-lg font-semibold text-white active:bg-stone-700"
      >
        Nouveau devis
      </Link>
      <nav className="flex flex-col gap-3">
        <Link href="/devis" className={linkClass}>
          Devis
          <span aria-hidden="true">›</span>
        </Link>
        <Link href="/grille" className={linkClass}>
          Ma grille de prix
          <span aria-hidden="true">›</span>
        </Link>
        <Link href="/entreprise" className={linkClass}>
          Mon entreprise
          <span aria-hidden="true">›</span>
        </Link>
      </nav>
    </main>
  );
}
