import Link from "next/link";

export default function QuoteNotFound() {
  return (
    <div className="flex flex-col gap-3 py-8">
      <h1 className="text-2xl font-semibold">Devis introuvable</h1>
      <p className="text-stone-600">Ce devis n&apos;existe pas ou a été supprimé.</p>
      <Link href="/devis" className="inline-flex min-h-11 items-center text-sm text-stone-700 underline">
        Retour aux devis
      </Link>
    </div>
  );
}
