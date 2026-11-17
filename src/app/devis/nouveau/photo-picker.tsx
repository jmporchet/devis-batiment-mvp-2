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
  return <img ref={ref} alt={alt} className="h-20 w-20 shrink-0 rounded-lg bg-stone-200 object-cover" />;
}

/**
 * Trois emplacements photo. Chaque emplacement libre propose l'appareil photo
 * et la galerie ; les fichiers restent en mémoire jusqu'à l'envoi.
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

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div className="flex flex-col gap-2">
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
      <ul className="flex flex-col gap-2">
        {Array.from({ length: MAX_PHOTOS }, (_, index) => {
          const photo = photos[index];
          return (
            <li key={index} className="rounded-xl border border-stone-200 bg-white p-3">
              {photo ? (
                <div className="flex items-center gap-3">
                  <Thumbnail file={photo.file} alt={`Photo ${index + 1}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Photo {index + 1}</p>
                    <p className="text-xs text-stone-500">{Math.max(1, Math.round(photo.file.size / 1024))} Ko</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(photo.key)}
                    disabled={disabled}
                    className={secondaryButton}
                    aria-label={`Retirer la photo ${index + 1}`}
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-stone-600">Photo {index + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={disabled || processing || full}
                      onClick={() => cameraRef.current?.click()}
                    >
                      Prendre une photo
                    </button>
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={disabled || processing || full}
                      onClick={() => galleryRef.current?.click()}
                    >
                      Choisir dans la galerie
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {processing ? (
        <p role="status" className="text-sm text-stone-600">
          Préparation des photos…
        </p>
      ) : null}
    </div>
  );
}
