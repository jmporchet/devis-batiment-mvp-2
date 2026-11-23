"use client";

import { useEffect, useRef } from "react";
import { MAX_PHOTOS } from "@/domain/types";
import { ErrorRegion } from "./error-message";

export interface CapturedPhoto {
  key: number;
  file: File;
}

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-500 bg-white px-3 text-center text-base font-medium text-stone-900 active:bg-stone-100 disabled:opacity-60";

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
 * Bloc photos, groupé en <fieldset>/<legend> (le compteur est dans la
 * légende). « Prendre une photo » ouvre l'appareil (une photo à la fois) ;
 * « Choisir des photos » ouvre la galerie avec sélection multiple. De 1 à
 * MAX_PHOTOS photos, gardées en mémoire jusqu'à l'envoi.
 */
export function PhotoPicker({
  photos,
  processing,
  disabled,
  status,
  error,
  onPick,
  onRemove,
}: {
  photos: CapturedPhoto[];
  processing: boolean;
  disabled: boolean;
  /** Message d'état (photos ajoutées ou retirées), annoncé poliment. */
  status: string;
  /** Erreur propre à ce bloc (trop de photos). */
  error: string;
  onPick: (files: File[]) => void;
  onRemove: (key: number) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const galleryButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Rang de la photo retirée : le focus passe à sa voisine après le rendu.
  const focusAfterRemove = useRef<number | null>(null);

  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button");
    const next = buttons && buttons.length > 0 ? buttons[Math.min(index, buttons.length - 1)] : null;
    (next ?? galleryButtonRef.current)?.focus();
  }, [photos]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) onPick(files);
  }

  const full = photos.length >= MAX_PHOTOS;
  // Pendant la préparation, pas de nouvelle sélection : l'ordre est conservé.
  const pickDisabled = disabled || processing || full;

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-lg font-semibold">
        Photos <span className="text-base font-normal text-stone-700">({photos.length}/{MAX_PHOTOS})</span>
      </legend>
      <p className="text-sm text-stone-700">
        De 1 à {MAX_PHOTOS} photos. Dans la galerie, vous pouvez en choisir plusieurs à la fois.
      </p>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handle}
        data-testid="photo-camera"
        tabIndex={-1}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handle}
        data-testid="photo-gallery"
        tabIndex={-1}
      />

      {photos.length > 0 ? (
        <ul ref={listRef} role="list" className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.key} className="relative">
              <Thumbnail file={photo.file} alt={`Photo ${index + 1} sur ${photos.length}`} />
              <button
                type="button"
                onClick={() => {
                  focusAfterRemove.current = index;
                  onRemove(photo.key);
                }}
                disabled={disabled}
                aria-label={`Retirer la photo ${index + 1}`}
                className="absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-full border-2 border-white bg-stone-900 text-xl leading-none text-white active:bg-black disabled:opacity-60"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-500 bg-white p-4 text-center text-sm text-stone-700">
          Aucune photo pour l&apos;instant.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={secondaryButton} disabled={pickDisabled} onClick={() => cameraRef.current?.click()}>
          Prendre une photo
        </button>
        <button
          ref={galleryButtonRef}
          type="button"
          className={secondaryButton}
          disabled={pickDisabled}
          onClick={() => galleryRef.current?.click()}
        >
          Choisir des photos
        </button>
      </div>

      <p role="status" className="text-sm text-stone-700">
        {processing ? "Préparation des photos…" : status}
      </p>
      <ErrorRegion message={error} />
    </fieldset>
  );
}
