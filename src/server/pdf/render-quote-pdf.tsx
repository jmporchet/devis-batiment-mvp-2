import "server-only";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import type { Company, Quote } from "@/domain/types";
import { PDF_FONT, QuoteDocument } from "./quote-document";

/**
 * Génère le PDF d'un devis. Polices : Source Sans 3 (licence OFL, voir
 * `fonts/LICENSE-SourceSans3.txt`), embarquées dans le dépôt.
 */

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "src", "server", "pdf", "fonts");
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: path.join(dir, "SourceSans3-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "SourceSans3-Bold.ttf"), fontWeight: 700 },
      { src: path.join(dir, "SourceSans3-It.ttf"), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  // Pas de césure automatique : les désignations restent lisibles telles quelles.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export async function renderQuotePdf(
  quote: Quote,
  company: Company,
  logo: { bytes: Buffer; mimeType: string } | null,
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<QuoteDocument quote={quote} company={company} logo={logo} />);
}
