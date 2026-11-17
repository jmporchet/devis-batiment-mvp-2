/** Logique pure de la capture terrain (testée, sans accès au navigateur). */

export const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"] as const;

/** Premier type d'enregistrement accepté par le navigateur, ou undefined. */
export function pickAudioMimeType(isSupported: (mime: string) => boolean): string | undefined {
  return AUDIO_MIME_CANDIDATES.find((mime) => isSupported(mime));
}

/** Extension de fichier pour un type MIME audio (partie avant « ; » ignorée). */
export function audioExtension(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm") return "webm";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return "m4a";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  return "webm";
}

export const MAX_PHOTO_SIDE = 2000;

/** Dimensions réduites : côté long ≤ max, proportions conservées, jamais agrandi. */
export function scaledDimensions(
  width: number,
  height: number,
  max = MAX_PHOTO_SIDE,
): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= max) return { width, height };
  const ratio = max / longSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Chronomètre « m:ss ». */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type MicIssue = "insecure" | "no-recorder" | "denied" | "no-device";

export const MIC_MESSAGES: Record<MicIssue, string> = {
  insecure:
    "Le micro n'est disponible qu'en HTTPS ou sur localhost : ouvrez l'application en HTTPS, ou joignez un fichier audio.",
  "no-recorder":
    "Ce navigateur ne peut pas enregistrer de son. Joignez un fichier audio à la place.",
  denied:
    "Accès au micro refusé. Autorisez le micro dans les réglages du navigateur, ou joignez un fichier audio.",
  "no-device": "Aucun micro détecté. Joignez un fichier audio à la place.",
};

/** Diagnostic avant tout accès au micro ; null si l'enregistrement est possible. */
export function detectMicIssue(env: {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasMediaRecorder: boolean;
}): MicIssue | null {
  if (!env.isSecureContext) return "insecure";
  if (!env.hasMediaDevices || !env.hasMediaRecorder) return "no-recorder";
  return null;
}

/** Traduit l'erreur de getUserMedia en problème affichable. */
export function micIssueFromError(error: unknown): MicIssue {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "denied";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "no-device";
  }
  return "denied";
}
