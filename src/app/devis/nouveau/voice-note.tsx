"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MAX_AUDIO_SECONDS } from "@/domain/types";
import { ErrorRegion } from "./error-message";
import {
  MIC_MESSAGES,
  audioExtension,
  detectMicIssue,
  formatTimer,
  micIssueFromError,
  pickAudioMimeType,
  type MicIssue,
} from "./capture-utils";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-500 bg-white px-4 text-base font-medium text-stone-900 active:bg-stone-100 disabled:opacity-60";

function noopSubscribe() {
  return () => {};
}

/** Diagnostic de l'environnement, calculé côté navigateur uniquement. */
function readEnvIssue(): MicIssue | null {
  return detectMicIssue({
    isSecureContext: window.isSecureContext,
    hasMediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    hasMediaRecorder: typeof MediaRecorder !== "undefined",
  });
}

function AudioPreview({ file, focusOnMount }: { file: File; focusOnMount: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const url = URL.createObjectURL(file);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Le bouton d'enregistrement disparaît à l'arrêt : le focus passe au lecteur.
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <audio
      ref={ref}
      controls
      preload="metadata"
      aria-label="Écouter la note vocale enregistrée"
      className="w-full"
      data-testid="audio-preview"
    />
  );
}

/**
 * Note vocale : enregistrement MediaRecorder avec chronomètre et arrêt
 * automatique, écoute de contrôle, ou repli sur un fichier audio.
 */
export function VoiceNote({
  value,
  disabled,
  onChange,
  onRecordingChange,
  confirmRestart,
}: {
  value: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
  onRecordingChange: (recording: boolean) => void;
  /** Demande confirmation avant d'effacer la note ; résout à true si confirmé. */
  confirmRestart: () => Promise<boolean>;
}) {
  const envIssue = useSyncExternalStore(noopSubscribe, readEnvIssue, () => null);
  const [runtimeIssue, setRuntimeIssue] = useState<MicIssue | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("");
  const [focusPreview, setFocusPreview] = useState(false);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusRecordRef = useRef(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacks = useRef({ onChange, onRecordingChange });
  useEffect(() => {
    callbacks.current = { onChange, onRecordingChange };
  });

  function releaseMic() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Quitter la page : arrêter l'enregistrement et libérer le micro.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      releaseMic();
    };
  }, []);

  // Après « Recommencer », le bouton d'enregistrement revient : le focus y retourne.
  useEffect(() => {
    if (!focusRecordRef.current) return;
    const target = recordButtonRef.current ?? fileInputRef.current;
    if (!target) return;
    focusRecordRef.current = false;
    target.focus();
  });

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function start() {
    setRuntimeIssue(null);
    setStatus("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setRuntimeIssue(micIssueFromError(error));
      return;
    }

    const mimeType = pickAudioMimeType((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setRuntimeIssue("no-recorder");
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      releaseMic();
      recorderRef.current = null;
      setRecording(false);
      callbacks.current.onRecordingChange(false);
      const seconds = Math.min(MAX_AUDIO_SECONDS, (Date.now() - startedAt) / 1000);
      const type = (recorder.mimeType || mimeType || chunks[0]?.type || "audio/webm").toLowerCase();
      if (chunks.length > 0) {
        const file = new File(chunks, `note-vocale.${audioExtension(type)}`, { type });
        callbacks.current.onChange(file);
        setFocusPreview(true);
        setStatus(`Note vocale enregistrée, durée ${formatTimer(seconds)}. Vous pouvez l'écouter.`);
      } else {
        setStatus("");
      }
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    const startedAt = Date.now();
    setElapsed(0);
    recorder.start();
    setRecording(true);
    setStatus(`Enregistrement en cours, ${MAX_AUDIO_SECONDS} secondes au maximum.`);
    callbacks.current.onRecordingChange(true);
    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_AUDIO_SECONDS) stop();
    }, 250);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    onChange(file);
    setFocusPreview(true);
    setStatus(`Fichier audio joint : ${file.name}.`);
  }

  async function restart() {
    if (!(await confirmRestart())) return;
    focusRecordRef.current = true;
    setFocusPreview(false);
    setStatus("Note vocale supprimée. Vous pouvez enregistrer à nouveau.");
    onChange(null);
  }

  const issue = envIssue ?? runtimeIssue;
  const canRecord = envIssue === null;
  const nearEnd = recording && elapsed >= MAX_AUDIO_SECONDS - 10;

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-lg font-semibold">Note vocale</legend>
      <p className="text-sm text-stone-700">
        Dictez ce qu&apos;il y a à faire, {MAX_AUDIO_SECONDS} secondes au maximum.
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-stone-400 bg-white p-3">
        {value && !recording ? (
          <>
            <AudioPreview file={value} focusOnMount={focusPreview} />
            <button type="button" className={secondaryButton} disabled={disabled} onClick={restart}>
              Recommencer la note vocale
            </button>
          </>
        ) : canRecord ? (
          <>
            {recording ? (
              <p
                role="timer"
                aria-label="Durée de l'enregistrement"
                className={`text-center text-3xl font-semibold tabular-nums ${nearEnd ? "text-red-700" : ""}`}
              >
                {formatTimer(elapsed)}
                <span className="text-base font-normal text-stone-700"> / {formatTimer(MAX_AUDIO_SECONDS)}</span>
              </p>
            ) : null}
            <button
              ref={recordButtonRef}
              type="button"
              onClick={recording ? stop : start}
              disabled={disabled}
              className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-xl px-4 text-lg font-semibold text-white disabled:opacity-60 ${
                recording ? "bg-red-700 active:bg-red-800" : "bg-stone-900 active:bg-stone-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={recording ? "h-4 w-4 rounded-sm bg-white" : "h-4 w-4 rounded-full bg-red-500"}
              />
              {recording ? "Arrêter l'enregistrement" : runtimeIssue ? "Réessayer le micro" : "Enregistrer une note vocale"}
            </button>
          </>
        ) : null}

        {issue && !value && !recording ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Joindre un fichier audio
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              disabled={disabled}
              onChange={handleFile}
              data-testid="audio-file"
              className="min-h-12 text-base file:mr-3 file:min-h-12 file:rounded-lg file:border file:border-stone-500 file:bg-white file:px-3 file:text-base file:font-medium"
            />
          </label>
        ) : null}
      </div>

      <p role="status" className="text-sm text-stone-700">
        {status}
      </p>
      <ErrorRegion message={issue && !value && !recording ? MIC_MESSAGES[issue] : ""} />
    </fieldset>
  );
}
