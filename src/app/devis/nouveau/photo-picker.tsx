"use client";

import { useEffect, useRef } from "react";
import { MAX_PHOTOS } from "@/domain/types";

export interface CapturedPhoto {
  key: number;
  file: File;
}

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 text-center text-sm font-medium text-stone-900 active:bg-stone-100 disabled:opacity-50";

function Thumbnail({ file, alt }: { file: File; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const url = URL.createObjectURL(file);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} className="aspect-square w-full rounded-lg bg-stone-200 object-cover" />;
}

/**
 * Un seul bloc photos : vignettes des photos choisies, puis deux boutons.
 * « Prendre une photo » ouvre l'appareil (une photo à la fois) ; « Choisir des
 * photos » ouvre la galerie avec sélection multiple. De 1 à MAX_PHOTOS photos,
 * gardées en mémoire jusqu'à l'envoi.
 */
export function PhotoPicker({
  photos,
  processing,
  disabled,
  onPick,
  onRemove,
}: {
  photos: CapturedPhoto[];
  processing: boolean;
  disabled: boolean;
  onPick: (files: File[]) => void;
  onRemove: (key: number) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) onPick(files);
  }

  const remaining = MAX_PHOTOS - photos.length;
  const full = remaining <= 0;
  // Pendant la préparation, pas de nouvelle sélection : l'ordre est conservé.
  const pickDisabled = disabled || processing || full;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handle}
        data-testid="photo-camera"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handle}
        data-testid="photo-gallery"
      />

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2" aria-label="Photos choisies">
          {photos.map((photo, index) => (
            <li key={photo.key} className="relative">
              <Thumbnail file={photo.file} alt={`Photo ${index + 1}`} />
              <button
                type="button"
                onClick={() => onRemove(photo.key)}
                disabled={disabled}
                aria-label={`Retirer la photo ${index + 1}`}
                className="absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-full bg-stone-900/75 text-xl leading-none text-white active:bg-stone-900 disabled:opacity-50"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-4 text-center text-sm text-stone-500">
          Aucune photo pour l&apos;instant.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={secondaryButton} disabled={pickDisabled} onClick={() => cameraRef.current?.click()}>
          Prendre une photo
        </button>
        <button type="button" className={secondaryButton} disabled={pickDisabled} onClick={() => galleryRef.current?.click()}>
          Choisir des photos
        </button>
      </div>

      <p className="text-sm text-stone-600" role="status">
        {processing
          ? "Préparation des photos…"
          : full
            ? `Maximum atteint : ${MAX_PHOTOS} photos.`
            : `De 1 à ${MAX_PHOTOS} photos. Dans la galerie, vous pouvez en choisir plusieurs à la fois${
                photos.length > 0 ? ` (encore ${remaining})` : ""
              }.`}
      </p>
    </div>
  );
}
