"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { Field } from "@/components/field";
import { useConfirm } from "@/components/confirm-dialog";
import { MAX_PHOTOS } from "@/domain/types";
import { createQuoteAction, type CaptureState } from "./actions";
import { ErrorRegion } from "./error-message";
import { PhotoPicker, type CapturedPhoto } from "./photo-picker";
import { resizePhoto } from "./resize-photo";
import { VoiceNote } from "./voice-note";

const INITIAL_STATE: CaptureState = { message: "", fieldErrors: {} };

function photoCount(n: number): string {
  return n === 0 ? "aucune photo" : n === 1 ? "1 photo" : `${n} photos`;
}

export function CaptureForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createQuoteAction, INITIAL_STATE);
  const [dialog, confirm] = useConfirm();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [processing, setProcessing] = useState(0);
  const [recording, setRecording] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const nextKey = useRef(1);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  async function pickPhotos(files: File[]) {
    setPhotoError("");
    setSubmitError("");
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) {
      setPhotoError(
        `Vous avez choisi trop de photos : ${MAX_PHOTOS} au maximum par devis. Les photos en trop sont ignorées ; retirez une photo pour en ajouter une autre.`,
      );
    }
    const selected = files.slice(0, Math.max(0, room));
    if (selected.length === 0) return;
    setProcessing((n) => n + 1);
    try {
      const resized = await Promise.all(selected.map(resizePhoto));
      setPhotos((current) =>
        [...current, ...resized.map((file) => ({ key: nextKey.current++, file }))].slice(0, MAX_PHOTOS),
      );
      const total = photos.length + resized.length;
      setPhotoStatus(
        `${photoCount(resized.length)} ajoutée${resized.length > 1 ? "s" : ""} : ${total} sur ${MAX_PHOTOS}.${
          total >= MAX_PHOTOS ? " Maximum atteint." : ""
        }`,
      );
    } finally {
      setProcessing((n) => n - 1);
    }
  }

  function removePhoto(key: number) {
    const index = photos.findIndex((p) => p.key === key);
    const left = photos.length - 1;
    setPhotos((current) => current.filter((p) => p.key !== key));
    setPhotoError("");
    setPhotoStatus(`Photo ${index + 1} retirée : ${left} sur ${MAX_PHOTOS}.`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem =
      recording
        ? "Arrêtez l'enregistrement de la note vocale avant de créer le devis."
        : processing > 0
          ? "La préparation des photos n'est pas terminée : attendez un instant, puis créez le devis."
          : photos.length === 0 && !audio
            ? "Ajoutez au moins une photo ou enregistrez une note vocale, puis créez le devis."
            : "";
    setSubmitError(problem);
    if (problem) {
      // Le focus suit l'erreur : le lecteur d'écran la lit, le clavier y est.
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const data = new FormData(event.currentTarget);
    for (const { file } of photos) data.append("photos", file, file.name);
    if (audio) data.append("audio", audio, audio.name);
    startTransition(() => formAction(data));
  }

  // Après un refus du serveur : focus sur le champ en erreur, sinon sur le message.
  useEffect(() => {
    if (state === INITIAL_STATE) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (field ?? errorRef.current)?.focus();
  }, [state]);

  const busy = pending;
  // Une capture en cours : des photos choisies, une note enregistrée ou en cours.
  const dirty = photos.length > 0 || audio !== null || recording;

  // Quitter la page (rechargement, fermeture d'onglet) avec une capture en cours.
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Lien interne cliqué avec une capture en cours : confirmation d'abord.
  useEffect(() => {
    if (!dirty) return;
    function intercept(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      void confirm({
        title: "Quitter la capture ?",
        message: "Vos photos et votre note vocale ne sont pas encore enregistrées : si vous quittez cette page, elles seront perdues.",
        confirmLabel: "Quitter et tout perdre",
        cancelLabel: "Rester sur la page",
        destructive: true,
      }).then((ok) => {
        if (ok) router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    }
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [dirty, confirm, router]);

  const error = submitError || state.message;

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="titre-nouveau-devis" className="flex flex-col gap-6">
        <PhotoPicker
          photos={photos}
          processing={processing > 0}
          disabled={busy}
          status={photoStatus}
          error={photoError}
          onPick={pickPhotos}
          onRemove={removePhoto}
        />

        <VoiceNote
          value={audio}
          disabled={busy}
          onChange={(file) => {
            setAudio(file);
            setSubmitError("");
          }}
          onRecordingChange={setRecording}
          confirmRestart={() =>
            confirm({
              title: "Recommencer la note vocale ?",
              message: "L'enregistrement actuel sera supprimé : vous ne pourrez pas le récupérer.",
              confirmLabel: "Supprimer et recommencer",
              cancelLabel: "Garder la note",
              destructive: true,
            })
          }
        />

        <Field
          name="title"
          label="Objet du devis (facultatif)"
          hint="Par exemple : Salle de bain 6 m²."
          error="L'objet est limité à 200 caractères : raccourcissez-le."
          serverError={state.fieldErrors.title}
        >
          {(control) => (
            <input
              {...control}
              type="text"
              maxLength={200}
              autoComplete="off"
              enterKeyHint="done"
              disabled={busy}
            />
          )}
        </Field>

        <ErrorRegion ref={errorRef} message={error} />

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-14 rounded-xl bg-stone-900 px-4 text-lg font-semibold text-white active:bg-stone-700 disabled:opacity-60"
          >
            Créer le devis
          </button>
          <p role="status" className="text-center text-sm text-stone-700">
            {busy ? "Création du devis en cours…" : ""}
          </p>
        </div>
      </form>
      {dialog}
    </>
  );
}
