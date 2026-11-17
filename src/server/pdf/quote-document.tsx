import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { computeTotals } from "@/domain/pricing";
import type { Company, Quote } from "@/domain/types";
import {
  buildRows,
  buildTotalsRows,
  countUnpriced,
  placeAndDate,
  provisionalText,
  validityText,
} from "./quote-pdf-data";

/**
 * Document PDF d'un devis, A4 portrait. Les notes internes (`quote.notes`)
 * ne sont volontairement jamais lues ici : elles sont destinées au chef de chantier.
 */

export const PDF_FONT = "SourceSans3";

const MM = 72 / 25.4;
const mm = (n: number) => n * MM;

const INK = "#1c1917";
const MUTED = "#6b6560";
const LINE = "#d6d3d1";
const ACCENT = "#44403c";

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9.5,
    color: INK,
    paddingTop: mm(18),
    paddingBottom: mm(24),
    paddingHorizontal: mm(18),
  },
  header: { height: mm(56), position: "relative" },
  sender: { width: mm(90) },
  logo: {
    maxHeight: mm(18),
    maxWidth: mm(60),
    objectFit: "contain",
    objectPosition: "left top",
    marginBottom: mm(3),
  },
  senderName: { fontWeight: 700, fontSize: 11, marginBottom: 1 },
  senderLine: { fontSize: 9, color: ACCENT },
  recipient: {
    position: "absolute",
    top: mm(32),
    left: mm(100),
    width: mm(74),
    fontSize: 10.5,
  },
  recipientName: { fontWeight: 700 },
  recipientEmpty: { color: "#9a948e" },
  placeDate: { textAlign: "right", color: ACCENT, marginBottom: mm(6) },
  title: { fontSize: 18, fontWeight: 700 },
  provisional: { marginTop: 4, color: MUTED, fontStyle: "italic" },
  subject: { marginTop: mm(4), fontSize: 11 },
  subjectLabel: { fontWeight: 700 },

  table: { marginTop: mm(7) },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 3,
    paddingTop: 2,
    fontWeight: 700,
    fontSize: 8.5,
    color: INK,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 4,
  },
  cPos: { width: 28 },
  cLabel: { flex: 1, paddingRight: 8 },
  cQty: { width: 50, textAlign: "right" },
  cUnit: { width: 44, paddingLeft: 8 },
  cPrice: { width: 72, textAlign: "right" },
  cTotal: { width: 72, textAlign: "right" },
  unpriced: { fontStyle: "italic", color: MUTED },

  totals: { marginTop: mm(5), alignSelf: "flex-end", width: mm(86) },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalSub: { fontSize: 8, color: MUTED },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: 3,
    paddingTop: 4,
    fontWeight: 700,
    fontSize: 12,
  },
  provisionalNote: {
    marginTop: 4,
    textAlign: "right",
    fontStyle: "italic",
    color: MUTED,
  },

  conditions: { marginTop: mm(9) },
  h2: { fontWeight: 700, fontSize: 10, marginBottom: 3 },
  condLine: { marginBottom: 2 },
  footerNote: { marginTop: 4, fontSize: 8.5, color: ACCENT },

  accept: {
    marginTop: mm(9),
    borderWidth: 0.75,
    borderColor: INK,
    padding: mm(4),
  },
  acceptTitle: { fontWeight: 700, fontSize: 11, marginBottom: 2 },
  acceptText: { fontSize: 9, color: ACCENT },
  signRow: { flexDirection: "row", marginTop: mm(8), gap: mm(8) },
  signCell: { flex: 1 },
  signLine: { borderBottomWidth: 0.75, borderBottomColor: INK, height: mm(14) },
  signLabel: { marginTop: 2, fontSize: 8.5, color: MUTED },

  footer: {
    position: "absolute",
    bottom: mm(10),
    left: mm(18),
    right: mm(18),
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 4,
    fontSize: 8,
    color: MUTED,
  },
  watermark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  watermarkText: {
    fontSize: 84,
    fontWeight: 700,
    color: "#eceae7",
    transform: "rotate(-45deg)",
    letterSpacing: 6,
  },
});

export interface PdfLogo {
  bytes: Buffer;
  mimeType: string;
}

function addressLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function QuoteDocument({
  quote,
  company,
  logo,
}: {
  quote: Quote;
  company: Company;
  logo: PdfLogo | null;
}) {
  const totals = computeTotals(quote.lines);
  const rows = buildRows(quote.lines);
  const unpriced = countUnpriced(quote.lines);
  const totalsRows = buildTotalsRows(totals, company);
  const isDraft = quote.status !== "valide";
  const clientLines = addressLines(quote.clientAddress);
  const hasClient = quote.clientName.trim() !== "" || clientLines.length > 0;
  const contact = [company.phone, company.email, company.website].filter(
    (v) => v.trim() !== "",
  );
  const footerLeft = [company.name, company.vatNumber]
    .filter((v) => v.trim() !== "")
    .join(" · ");

  return (
    <Document
      title={`Devis ${quote.number}`}
      author={company.name}
      creator={company.name}
      language="fr-CH"
    >
      <Page size="A4" style={s.page}>
        {isDraft && (
          <View style={s.watermark} fixed>
            <Text style={s.watermarkText}>BROUILLON</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{footerLeft}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber}/${totalPages}`
            }
          />
        </View>

        <View style={s.header}>
          <View style={s.sender}>
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, pas un <img> HTML
              <Image
                src={{
                  data: logo.bytes,
                  format: logo.mimeType === "image/png" ? "png" : "jpg",
                }}
                style={s.logo}
              />
            )}
            <Text style={s.senderName}>{company.name}</Text>
            {company.street.trim() !== "" && (
              <Text style={s.senderLine}>{company.street}</Text>
            )}
            {company.postalCity.trim() !== "" && (
              <Text style={s.senderLine}>{company.postalCity}</Text>
            )}
            {contact.map((c) => (
              <Text key={c} style={s.senderLine}>
                {c}
              </Text>
            ))}
          </View>
          <View style={s.recipient}>
            {hasClient ? (
              <>
                {quote.clientName.trim() !== "" && (
                  <Text style={s.recipientName}>{quote.clientName.trim()}</Text>
                )}
                {clientLines.map((l, i) => (
                  <Text key={i}>{l}</Text>
                ))}
              </>
            ) : (
              <Text style={s.recipientEmpty}>Client à compléter</Text>
            )}
          </View>
        </View>

        <Text style={s.placeDate}>
          {placeAndDate(company, quote.createdAt)}
        </Text>
        <Text style={s.title}>Devis n° {quote.number}</Text>
        {isDraft && (
          <Text style={s.provisional}>
            Document provisoire, non contractuel
          </Text>
        )}
        {quote.title.trim() !== "" && (
          <Text style={s.subject}>
            <Text style={s.subjectLabel}>Objet : </Text>
            {quote.title.trim()}
          </Text>
        )}

        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={s.cPos}>Pos.</Text>
            <View style={s.cLabel}>
              <Text>Désignation</Text>
            </View>
            <Text style={s.cQty}>Quantité</Text>
            <Text style={s.cUnit}>Unité</Text>
            <Text style={s.cPrice}>Prix unit. HT</Text>
            <Text style={s.cTotal}>Total HT</Text>
          </View>
          {rows.map((row) => (
            <View key={row.position} style={s.tr} wrap={false}>
              <Text style={s.cPos}>{row.position}</Text>
              <View style={s.cLabel}>
                <Text>{row.label}</Text>
              </View>
              <Text style={s.cQty}>{row.quantity}</Text>
              <Text style={s.cUnit}>{row.unit}</Text>
              {row.unitPrice === null ? (
                <>
                  <Text style={[s.cPrice, s.unpriced]}>à chiffrer</Text>
                  <Text style={[s.cTotal, s.unpriced]}>à chiffrer</Text>
                </>
              ) : (
                <>
                  <Text style={s.cPrice}>{row.unitPrice}</Text>
                  <Text style={s.cTotal}>{row.total}</Text>
                </>
              )}
            </View>
          ))}
          {rows.length === 0 && (
            <View style={s.tr}>
              <View style={s.cLabel}>
                <Text style={s.unpriced}>Aucune ligne.</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.totals} wrap={false}>
          {totalsRows.map((r) =>
            r.strong ? (
              <View key={r.label} style={s.grand}>
                <Text>{r.label}</Text>
                <Text>{r.value}</Text>
              </View>
            ) : (
              <View key={r.label} style={s.totalRow}>
                <View>
                  <Text>{r.label}</Text>
                  {r.sublabel && (
                    <Text style={s.totalSub}>N° {r.sublabel}</Text>
                  )}
                </View>
                <Text>{r.value}</Text>
              </View>
            ),
          )}
          {totals.hasUnpricedLines && (
            <Text style={s.provisionalNote}>{provisionalText(unpriced)}</Text>
          )}
        </View>

        <View style={s.conditions} wrap={false}>
          <Text style={s.h2}>Conditions</Text>
          <Text style={s.condLine}>
            {validityText(quote.createdAt, company.validityDays)}.
          </Text>
          {company.paymentTerms.trim() !== "" && (
            <Text style={s.condLine}>
              Conditions de paiement : {company.paymentTerms.trim()}.
            </Text>
          )}
          {company.iban.trim() !== "" && (
            <Text style={s.condLine}>IBAN : {company.iban.trim()}</Text>
          )}
          {company.footerNote.trim() !== "" && (
            <Text style={s.footerNote}>{company.footerNote.trim()}</Text>
          )}
        </View>

        {/* Pas de « Bon pour accord » sur un document provisoire. */}
        {!isDraft && (
          <View style={s.accept} wrap={false}>
            <Text style={s.acceptTitle}>Bon pour accord</Text>
            <Text style={s.acceptText}>
              Le client accepte le présent devis n° {quote.number} et en
              autorise l’exécution.
            </Text>
            <View style={s.signRow}>
              <View style={s.signCell}>
                <View style={s.signLine} />
                <Text style={s.signLabel}>Lieu</Text>
              </View>
              <View style={s.signCell}>
                <View style={s.signLine} />
                <Text style={s.signLabel}>Date</Text>
              </View>
              <View style={[s.signCell, { flexGrow: 1.6 }]}>
                <View style={s.signLine} />
                <Text style={s.signLabel}>Signature du client</Text>
              </View>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
