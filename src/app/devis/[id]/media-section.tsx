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
        <div className="flex flex-col gap-2">
          <h3 id="photos-titre" className="text-sm font-medium">
            Photos du chantier ({photos.length})
          </h3>
          <ul aria-labelledby="photos-titre" className="flex flex-wrap gap-2">
            {photos.map((photo, i) => (
              <li key={photo.id}>
                {/* Le texte alternatif nomme le lien : il dit quelle photo et ce que le lien fait. */}
                <a
                  href={url(photo)}
                  target="_blank"
                  rel="noopener"
                  className="block overflow-hidden rounded-lg border border-stone-300 bg-stone-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- photos servies par la route média, pas d'optimisation voulue */}
                  <img
                    src={url(photo)}
                    alt={`Photo ${i + 1} sur ${photos.length} du chantier, ouvrir en grand dans un nouvel onglet`}
                    width={96}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    className="block aspect-square w-24 object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {audio && (
        <div className="flex flex-col gap-1">
          <p id="audio-titre" className="text-sm font-medium">
            Note vocale du chantier
          </p>
          <audio controls preload="metadata" src={url(audio)} aria-labelledby="audio-titre" className="w-full">
            Votre navigateur ne sait pas lire cette note vocale.
          </audio>
        </div>
      )}
    </section>
  );
}
