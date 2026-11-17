import fs from "node:fs/promises";
import { getDb } from "@/db/client";
import { getQuoteMediaFile } from "@/db/quotes";
import { mediaFilePath } from "@/server/media-store";

/**
 * Sert une photo ou une note vocale d'un devis. Gère les requêtes Range :
 * Safari en a besoin pour lire un <audio>.
 */
export async function GET(request: Request, ctx: RouteContext<"/devis/[id]/media/[mediaId]">) {
  const { id, mediaId } = await ctx.params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) return new Response("Introuvable", { status: 404 });
  const media = getQuoteMediaFile(getDb(), quoteId, mediaId);
  if (!media) return new Response("Introuvable", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(mediaFilePath(quoteId, media.fileName));
  } catch {
    return new Response("Fichier manquant", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "Accept-Ranges": "bytes",
    // Nom de fichier unique (UUID) : le contenu ne change jamais.
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = bytes.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const chunk = bytes.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.length) },
    });
  }

  return new Response(new Uint8Array(bytes), {
    headers: { ...headers, "Content-Length": String(bytes.length) },
  });
}
