import type { QuoteMedia } from "@/domain/types";

/** Photos (vignettes cliquables) et note vocale d'un devis. Rien sans média. */
export function MediaSection({ quoteId, media }: { quoteId: number; media: QuoteMedia[] }) {
  const photos = media.filter((m) => m.kind === "photo");
  const audio = media.find((m) => m.kind === "audio");
  if (photos.length === 0 && !audio) return null;
  const url = (m: QuoteMedia) => `/devis/${quoteId}/media/${m.id}`;

  return (
    <section aria-labelledby="medias-titre" className="flex flex-col gap-3">
      <h2 id="medias-titre" className="text-lg font-semibold">
        Photos et note vocale
      </h2>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo, i) => (
            <li key={photo.id}>
              <a
                href={url(photo)}
                target="_blank"
                rel="noopener"
                aria-label={`Ouvrir la photo ${i + 1} en grand`}
                className="block overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- photos servies par la route média, pas d'optimisation voulue */}
                <img
                  src={url(photo)}
                  alt={`Photo ${i + 1} du chantier`}
                  loading="lazy"
                  className="h-24 w-24 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {audio && (
        <audio controls preload="metadata" src={url(audio)} className="w-full">
          Votre navigateur ne sait pas lire cette note vocale.
        </audio>
      )}
    </section>
  );
}
