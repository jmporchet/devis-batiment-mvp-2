export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Devis chantier</h1>
        <p className="mt-1 text-stone-600">
          Photos et notes vocales, devis structuré en quelques minutes.
        </p>
      </header>
      <p className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-500">
        Socle en place. Les écrans arrivent dans les prochaines PRs.
      </p>
    </main>
  );
}
