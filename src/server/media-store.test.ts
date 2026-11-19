import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/create-db";
import { getQuote, listQuotes } from "@/db/quotes";
import { createQuoteFromCapture } from "./create-quote";
import { detectFormat, mediaFilePath, storeMediaFile } from "./media-store";

const pad = (head: number[] | string, size = 64) => {
  const start = typeof head === "string" ? Buffer.from(head, "latin1") : Buffer.from(head);
  return Buffer.concat([start, Buffer.alloc(Math.max(0, size - start.length))]);
};

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEIC = pad("\0\0\0\x18ftypheic");
const WEBM = pad([0x1a, 0x45, 0xdf, 0xa3]);
const M4A = pad("\0\0\0\x20ftypM4A ");
const OGG = pad("OggS");

const blob = (b: Buffer, type = "") => new Blob([new Uint8Array(b)], { type });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  process.env.MEDIA_DIR = dir;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDIA_DIR;
});

describe("detectFormat", () => {
  it.each([
    ["photo", JPEG, "image/jpeg"],
    ["photo", PNG, "image/png"],
    ["photo", HEIC, "image/heic"],
    ["audio", WEBM, "audio/webm"],
    ["audio", M4A, "audio/mp4"],
    ["audio", OGG, "audio/ogg"],
  ] as const)("%s : reconnaît %s", (kind, bytes, mime) => {
    expect(detectFormat(kind, bytes).mimeType).toBe(mime);
  });

  it("ignore le type annoncé et refuse un faux fichier", () => {
    expect(() => detectFormat("photo", pad("<html><script>"))).toThrow(/Format de photo/);
    expect(() => detectFormat("audio", JPEG)).toThrow(/Format audio/);
    expect(() => detectFormat("photo", Buffer.alloc(0))).toThrow(/vide/);
  });
});

describe("storeMediaFile", () => {
  it("écrit le fichier avec un nom UUID et l'extension détectée", async () => {
    const stored = await storeMediaFile(7, "photo", blob(JPEG, "text/plain"));
    expect(stored).toMatchObject({ kind: "photo", mimeType: "image/jpeg", sizeBytes: 64 });
    expect(stored.fileName).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(fs.readFileSync(mediaFilePath(7, stored.fileName))).toEqual(JPEG);
  });

  it("refuse un nom de fichier qui sortirait du dossier", () => {
    expect(() => mediaFilePath(1, "../../etc/passwd")).toThrow();
  });
});

describe("createQuoteFromCapture", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("crée un brouillon avec photos et note vocale", async () => {
    const quote = await createQuoteFromCapture(db, {
      photos: [blob(JPEG), blob(PNG), blob(Buffer.alloc(0))],
      audio: blob(WEBM),
    });
    expect(quote.status).toBe("brouillon");
    expect(quote.media.map((m) => m.mimeType)).toEqual(["image/jpeg", "image/png", "audio/webm"]);
    expect(fs.readdirSync(path.join(dir, String(quote.id)))).toHaveLength(3);
  });

  it("refuse une capture vide ou trop de photos", async () => {
    await expect(createQuoteFromCapture(db, { photos: [] })).rejects.toThrow(/au moins une photo/);
    await expect(createQuoteFromCapture(db, { photos: Array.from({ length: 6 }, () => blob(JPEG)) })).rejects.toThrow(/5 photos/);
    expect(listQuotes(db)).toHaveLength(0);
  });

  it("ne laisse ni devis ni fichier si un média est invalide", async () => {
    await expect(
      createQuoteFromCapture(db, { photos: [blob(JPEG), blob(pad("pas une image"))] }),
    ).rejects.toThrow(/Format de photo/);
    expect(listQuotes(db)).toHaveLength(0);
    expect(getQuote(db, 1)).toBeUndefined();
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });
});
