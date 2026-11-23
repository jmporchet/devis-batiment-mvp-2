import Link from "next/link";

const linkClass =
  "flex min-h-12 items-center justify-between rounded-xl border border-stone-200 bg-white px-4 text-base font-medium";

const MENU = [
  { href: "/devis", label: "Devis" },
  { href: "/grille", label: "Ma grille de prix" },
  { href: "/entreprise", label: "Mon entreprise" },
];

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
      <nav aria-label="Menu principal">
        <ul className="flex flex-col gap-3">
          {MENU.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={linkClass}>
                {item.label}
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
