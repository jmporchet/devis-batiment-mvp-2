import { getDb } from "@/db/client";
import { getCompany, getCompanyLogo } from "@/db/company";
import { getQuote } from "@/db/quotes";
import { contentDisposition, pdfFileName } from "@/server/pdf/quote-pdf-data";
import { renderQuotePdf } from "@/server/pdf/render-quote-pdf";

/** PDF du devis, tel qu'enregistré en base (affiché dans le navigateur). */
export async function GET(_request: Request, ctx: RouteContext<"/devis/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return new Response("Introuvable", { status: 404 });
  const db = getDb();
  const quote = getQuote(db, Number(id));
  if (!quote) return new Response("Introuvable", { status: 404 });

  const pdf = await renderQuotePdf(quote, getCompany(db), getCompanyLogo(db));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(pdfFileName(quote)),
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
