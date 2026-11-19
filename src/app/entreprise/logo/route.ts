import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getCompanyLogo } from "@/db/company";

/** Logo de l'entreprise (PNG ou JPEG), utilisé à l'écran et dans le PDF. */
export async function GET() {
  // Sans paramètre ni lecture de la requête, Next pré-rendrait la route au build
  // et figerait la première réponse (404 avant tout envoi de logo).
  await connection();
  const logo = getCompanyLogo(getDb());
  if (!logo) return new Response("Aucun logo", { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.mimeType,
      "Content-Length": String(logo.bytes.length),
      // Le logo peut changer : l'URL porte ?v=<updatedAt> côté écran.
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
