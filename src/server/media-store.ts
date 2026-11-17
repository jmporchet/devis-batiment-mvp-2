import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { QuoteError } from "@/db/quotes";
import type { MediaKind } from "@/domain/types";

/**
 * Stockage des photos et notes vocales sur le disque local :
 * MEDIA_DIR/<quoteId>/<uuid>.<ext>. Le type est vérifié sur le contenu du
 * fichier (signature), pas seulement sur ce qu'annonce le navigateur.
 */
// Les commentaires turbopackIgnore évitent que le build trace tout le projet
// à cause de chemins calculés à l'exécution.
export function mediaDir(): string {
  return process.env.MEDIA_DIR ?? "data/media";
}

const MB = 1024 * 1024;
export const MAX_BYTES: Record<MediaKind, number> = { photo: 15 * MB, audio: 10 * MB };

interface Format {
  mimeType: string;
  ext: string;
  sniff: (b: Buffer) => boolean;
}

const ascii = (b: Buffer, start: number, text: string) =>
  b.length >= start + text.length && b.toString("latin1", start, start + text.length) === text;

const FORMATS: Record<MediaKind, Format[]> = {
  photo: [
    { mimeType: "image/jpeg", ext: "jpg", sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mimeType: "image/png", ext: "png", sniff: (b) => ascii(b, 1, "PNG") && b[0] === 0x89 },
    { mimeType: "image/webp", ext: "webp", sniff: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP") },
    {
      mimeType: "image/heic",
      ext: "heic",
      sniff: (b) => ascii(b, 4, "ftyp") && /^(heic|heix|mif1|msf1|heim|heis)$/.test(b.toString("latin1", 8, 12)),
    },
  ],
  audio: [
    { mimeType: "audio/webm", ext: "webm", sniff: (b) => b.readUInt32BE(0) === 0x1a45dfa3 },
    { mimeType: "audio/ogg", ext: "ogg", sniff: (b) => ascii(b, 0, "OggS") },
    { mimeType: "audio/wav", ext: "wav", sniff: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE") },
    { mimeType: "audio/mpeg", ext: "mp3", sniff: (b) => ascii(b, 0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
    // Safari enregistre en MP4/AAC (ftyp M4A, mp42, isom…).
    { mimeType: "audio/mp4", ext: "m4a", sniff: (b) => ascii(b, 4, "ftyp") },
  ],
};

const KIND_LABEL: Record<MediaKind, string> = { photo: "La photo", audio: "La note vocale" };

/** Identifie le format d'un fichier ou lève une QuoteError lisible. */
export function detectFormat(kind: MediaKind, bytes: Buffer): Format {
  if (bytes.length === 0) throw new QuoteError(`${KIND_LABEL[kind]} est vide.`);
  if (bytes.length > MAX_BYTES[kind]) {
    throw new QuoteError(`${KIND_LABEL[kind]} dépasse ${MAX_BYTES[kind] / MB} Mo.`);
  }
  const format = bytes.length >= 12 ? FORMATS[kind].find((f) => f.sniff(bytes)) : undefined;
  if (!format) {
    throw new QuoteError(
      kind === "photo"
        ? "Format de photo non reconnu (JPEG, PNG, WebP ou HEIC attendus)."
        : "Format audio non reconnu (WebM, Ogg, MP4/M4A, MP3 ou WAV attendus).",
    );
  }
  return format;
}

export interface StoredMedia {
  id: string;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Vérifie puis écrit un fichier. À enregistrer ensuite avec `addQuoteMedia`. */
export async function storeMediaFile(quoteId: number, kind: MediaKind, file: Blob): Promise<StoredMedia> {
  if (file.size > MAX_BYTES[kind]) {
    throw new QuoteError(`${KIND_LABEL[kind]} dépasse ${MAX_BYTES[kind] / MB} Mo.`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = detectFormat(kind, bytes);
  const id = randomUUID();
  const fileName = `${id}.${format.ext}`;
  const dir = path.join(/* turbopackIgnore: true */ mediaDir(), String(quoteId));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(/* turbopackIgnore: true */ dir, fileName), bytes, { flag: "wx" });
  return { id, kind, fileName, mimeType: format.mimeType, sizeBytes: bytes.length };
}

/** Chemin absolu d'un fichier, avec garde contre la sortie du dossier. */
export function mediaFilePath(quoteId: number, fileName: string): string {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(fileName)) {
    throw new QuoteError("Nom de fichier invalide.");
  }
  return path.resolve(/* turbopackIgnore: true */ mediaDir(), String(quoteId), fileName);
}

/** Supprime le dossier d'un devis (nettoyage après un échec de création). */
export async function removeQuoteMediaDir(quoteId: number): Promise<void> {
  await fs.rm(path.join(/* turbopackIgnore: true */ mediaDir(), String(quoteId)), { recursive: true, force: true });
}
