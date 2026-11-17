"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MAX_AUDIO_SECONDS } from "@/domain/types";
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
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900 active:bg-stone-100 disabled:opacity-50";

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

function AudioPreview({ file }: { file: File }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const url = URL.createObjectURL(file);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <audio ref={ref} controls preload="metadata" className="w-full" data-testid="audio-preview" />;
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
}: {
  value: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
  onRecordingChange: (recording: boolean) => void;
}) {
  const envIssue = useSyncExternalStore(noopSubscribe, readEnvIssue, () => null);
  const [runtimeIssue, setRuntimeIssue] = useState<MicIssue | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

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

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function start() {
    setRuntimeIssue(null);
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
      const type = (recorder.mimeType || mimeType || chunks[0]?.type || "audio/webm").toLowerCase();
      if (chunks.length > 0) {
        const file = new File(chunks, `note-vocale.${audioExtension(type)}`, { type });
        callbacks.current.onChange(file);
      }
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    const startedAt = Date.now();
    setElapsed(0);
    recorder.start();
    setRecording(true);
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
    if (file) onChange(file);
  }

  const issue = envIssue ?? runtimeIssue;
  const canRecord = envIssue === null;
  const nearEnd = recording && elapsed >= MAX_AUDIO_SECONDS - 10;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3">
      {value && !recording ? (
        <>
          <AudioPreview file={value} />
          <button type="button" className={secondaryButton} disabled={disabled} onClick={() => onChange(null)}>
            Recommencer
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
              <span className="text-base font-normal text-stone-500"> / {formatTimer(MAX_AUDIO_SECONDS)}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={recording ? stop : start}
            disabled={disabled}
            className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-xl px-4 text-lg font-semibold text-white disabled:opacity-50 ${
              recording ? "bg-red-700 active:bg-red-800" : "bg-stone-900 active:bg-stone-700"
            }`}
          >
            <span
              aria-hidden="true"
              className={recording ? "h-4 w-4 rounded-sm bg-white" : "h-4 w-4 rounded-full bg-red-500"}
            />
            {recording ? "Arrêter l'enregistrement" : runtimeIssue ? "Réessayer le micro" : "Enregistrer une note vocale"}
          </button>
          {recording ? (
            <p className="text-center text-xs text-stone-500">
              Arrêt automatique après {MAX_AUDIO_SECONDS} secondes.
            </p>
          ) : null}
        </>
      ) : null}

      {issue && !recording ? (
        <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {MIC_MESSAGES[issue]}
        </div>
      ) : null}

      {issue && !value && !recording ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Joindre un fichier audio
          <input
            type="file"
            accept="audio/*"
            disabled={disabled}
            onChange={handleFile}
            data-testid="audio-file"
            className="min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-stone-300 file:bg-white file:px-3 file:text-sm file:font-medium"
          />
        </label>
      ) : null}
    </div>
  );
}
