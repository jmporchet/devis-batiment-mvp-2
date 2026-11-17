"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { MAX_PHOTOS } from "@/domain/types";
import { createQuoteAction, type CaptureState } from "./actions";
import { PhotoPicker, type CapturedPhoto } from "./photo-picker";
import { resizePhoto } from "./resize-photo";
import { VoiceNote } from "./voice-note";

const INITIAL_STATE: CaptureState = { message: "", fieldErrors: {} };

export function CaptureForm() {
  const [state, formAction, pending] = useActionState(createQuoteAction, INITIAL_STATE);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [processing, setProcessing] = useState(0);
  const [recording, setRecording] = useState(false);
  const [localError, setLocalError] = useState("");
  const nextKey = useRef(1);

  async function pickPhotos(files: File[]) {
    setLocalError("");
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setLocalError(`${MAX_PHOTOS} photos au maximum : les photos en trop sont ignorées.`);
    const selected = files.slice(0, Math.max(0, room));
    if (selected.length === 0) return;
    setProcessing((n) => n + 1);
    try {
      const resized = await Promise.all(selected.map(resizePhoto));
      setPhotos((current) =>
        [...current, ...resized.map((file) => ({ key: nextKey.current++, file }))].slice(0, MAX_PHOTOS),
      );
    } finally {
      setProcessing((n) => n - 1);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photos.length === 0 && !audio) {
      setLocalError("Ajoutez au moins une photo ou une note vocale.");
      return;
    }
    setLocalError("");
    const data = new FormData(event.currentTarget);
    for (const { file } of photos) data.append("photos", file, file.name);
    if (audio) data.append("audio", audio, audio.name);
    startTransition(() => formAction(data));
  }

  // Après une erreur serveur, ramener le message à l'écran.
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  const busy = pending;
  const canSubmit = !busy && processing === 0 && !recording;
  const error = localError || state.message;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section aria-labelledby="titre-photos" className="flex flex-col gap-2">
        <h2 id="titre-photos" className="text-lg font-semibold">
          Photos <span className="text-sm font-normal text-stone-500">({photos.length}/{MAX_PHOTOS})</span>
        </h2>
        <PhotoPicker
          photos={photos}
          processing={processing > 0}
          disabled={busy}
          onPick={pickPhotos}
          onRemove={(key) => setPhotos((current) => current.filter((p) => p.key !== key))}
        />
      </section>

      <section aria-labelledby="titre-note" className="flex flex-col gap-2">
        <h2 id="titre-note" className="text-lg font-semibold">
          Note vocale
        </h2>
        <VoiceNote
          value={audio}
          disabled={busy}
          onChange={setAudio}
          onRecordingChange={setRecording}
        />
      </section>

      <label className="flex flex-col gap-1 text-lg font-semibold">
        Objet <span className="text-sm font-normal text-stone-500">(facultatif)</span>
        <input
          name="title"
          type="text"
          maxLength={200}
          placeholder="Salle de bain 6 m²"
          disabled={busy}
          className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base font-normal text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </label>

      {error ? (
        <div ref={errorRef} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-14 rounded-xl bg-stone-900 px-4 text-lg font-semibold text-white active:bg-stone-700 disabled:opacity-50"
      >
        {busy ? "Envoi…" : "Créer le devis"}
      </button>
    </form>
  );
}
