import { z } from "zod";
import { UNIT_LABELS, UNITS, type PriceItem, type QuoteLine, type Unit } from "@/domain/types";

/**
 * Brouillon de devis par l'IA : construction de la demande et lecture de la
 * réponse. Fonctions pures, testées.
 *
 * Règle d'or : le modèle choisit des postes de la grille (par leur code) et
 * des quantités. Il ne voit pas les prix et ne les fixe jamais : libellé,
 * unité et prix sont relus dans la grille. Un travail absent de la grille
 * devient une ligne « à chiffrer ».
 */

export interface DraftMedia {
  kind: "photo" | "audio";
  mimeType: string;
  base64: string;
}

export interface DraftInput {
  title: string;
  notes: string;
  priceItems: PriceItem[];
  media: DraftMedia[];
}

export interface QuoteDraft {
  transcription: string;
  title: string;
  lines: QuoteLine[];
  /** Hypothèses et quantités estimées, à vérifier par le chef de chantier. */
  assumptions: string[];
}

export const MAX_DRAFT_LINES = 40;

const SYSTEM_PROMPT = `Tu es métreur dans une PME suisse romande du bâtiment (rénovation intérieure).
Un chef de chantier t'envoie une note vocale dictée sur place et jusqu'à 3 photos. Tu prépares un brouillon de devis qu'il relira et corrigera.

Règles :
1. Transcris fidèlement la note vocale en français (champ "transcription"). Sans note vocale, laisse une chaîne vide.
2. Propose les lignes de travaux en choisissant les postes dans la GRILLE fournie, par leur code exact. N'invente jamais de code.
3. Si un travail nécessaire n'existe pas dans la grille, ajoute une ligne avec "code": null, un libellé précis et l'unité la plus logique. Elle sera chiffrée à la main.
4. Quantités : reprends celles qui sont dictées. Sinon, déduis-les simplement (surface du sol, des murs, nombre d'appareils) ou estime-les d'après les photos. Une quantité estimée doit être signalée dans "hypotheses". Si tu ne peux pas estimer, mets 1 et signale-le.
5. Inclus les travaux dictés ou clairement visibles, et ceux qu'ils impliquent directement (par exemple démolir l'ancien revêtement avant d'en poser un neuf, évacuer les gravats d'une démolition). Chaque ligne déduite de cette façon doit être signalée dans "hypotheses".
6. N'ajoute pas de travaux qui ne sont ni dictés, ni visibles, ni directement impliqués. Pas de doublons.
7. Respecte l'unité du poste choisi (m², m, pce, forfait, h, m³). Les quantités ont au plus 2 décimales.
8. Tu ne fixes aucun prix : ils viennent de la grille.
9. "titre" : objet court du devis, par exemple « Rénovation salle de bain 6 m² ».
10. "hypotheses" : phrases courtes, une par point à vérifier, en citant le code concerné.`;

/** Schéma imposé à la réponse (structured outputs, mode strict). */
export const DRAFT_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "brouillon_devis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["transcription", "titre", "lignes", "hypotheses"],
      properties: {
        transcription: { type: "string" },
        titre: { type: "string" },
        lignes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["code", "libelle", "unite", "quantite"],
            properties: {
              code: { type: ["string", "null"], description: "Code exact d'un poste de la grille, ou null." },
              libelle: { type: "string" },
              unite: { type: "string", enum: [...UNITS] },
              quantite: { type: "number" },
            },
          },
        },
        hypotheses: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

/** La grille telle que le modèle la voit : code, libellé, unité. Sans prix. */
export function gridForPrompt(items: PriceItem[]): string {
  return items
    .filter((i) => i.active)
    .map((i) => `${i.id} | ${i.label} | ${UNIT_LABELS[i.unit]} (${i.unit})`)
    .join("\n");
}

/** Format audio attendu par l'API, d'après le type MIME stocké. */
export function audioFormat(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
  };
  return map[mimeType] ?? mimeType.replace(/^audio\//, "");
}

export function buildDraftMessages(input: DraftInput) {
  const photos = input.media.filter((m) => m.kind === "photo");
  const audio = input.media.find((m) => m.kind === "audio");
  const context = [
    input.title.trim() && `Objet saisi par le chef de chantier : ${input.title.trim()}`,
    input.notes.trim() && `Notes écrites : ${input.notes.trim()}`,
    `Photos jointes : ${photos.length}. Note vocale : ${audio ? "oui" : "non"}.`,
    `GRILLE (code | libellé | unité) :\n${gridForPrompt(input.priceItems)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: context },
        ...(audio
          ? [{ type: "input_audio" as const, input_audio: { data: audio.base64, format: audioFormat(audio.mimeType) } }]
          : []),
        ...photos.map((p) => ({
          type: "image_url" as const,
          image_url: { url: `data:${p.mimeType};base64,${p.base64}` },
        })),
      ],
    },
  ];
}

const responseSchema = z.object({
  transcription: z.string().default(""),
  titre: z.string().default(""),
  lignes: z
    .array(
      z.object({
        code: z.string().nullable().default(null),
        libelle: z.string().default(""),
        unite: z.string().default("forfait"),
        quantite: z.number().default(1),
      }),
    )
    .default([]),
  hypotheses: z.array(z.string()).default([]),
});

/** Extrait le JSON même si le modèle l'entoure de ```json … ```. */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

/**
 * Transforme la réponse du modèle en lignes de devis sûres :
 * code connu → libellé, unité et prix de la grille ; code inconnu ou null →
 * ligne « à chiffrer » ; quantité arrondie à 2 décimales, 1 si absurde.
 */
export function parseDraftResponse(content: string, priceItems: PriceItem[]): QuoteDraft {
  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(extractJson(content));
  } catch {
    throw new Error("Réponse IA non conforme au format attendu.");
  }
  const grid = new Map(priceItems.filter((i) => i.active).map((i) => [i.id.toUpperCase(), i]));
  const assumptions = parsed.hypotheses.map((h) => h.trim()).filter(Boolean);

  const lines: QuoteLine[] = [];
  for (const raw of parsed.lignes.slice(0, MAX_DRAFT_LINES)) {
    const code = raw.code?.trim().toUpperCase() || null;
    const item = code ? grid.get(code) : undefined;
    let quantity = Math.round(raw.quantite * 100) / 100;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
      assumptions.push(`${code ?? raw.libelle} : quantité proposée invalide (${raw.quantite}), remplacée par 1.`);
      quantity = 1;
    }
    if (item) {
      lines.push({
        priceItemId: item.id,
        label: item.label,
        unit: item.unit,
        quantity,
        unitPriceCents: item.unitPriceCents,
        source: "ai",
      });
      continue;
    }
    const label = raw.libelle.trim().slice(0, 300);
    if (!label) continue;
    if (code) assumptions.push(`Code ${code} inconnu dans la grille : ligne « ${label} » à chiffrer.`);
    lines.push({
      priceItemId: null,
      label,
      unit: (UNITS as readonly string[]).includes(raw.unite) ? (raw.unite as Unit) : "forfait",
      quantity,
      unitPriceCents: null,
      source: "ai",
    });
  }

  return {
    transcription: parsed.transcription.trim(),
    title: parsed.titre.trim().slice(0, 200),
    lines,
    assumptions,
  };
}

const AI_NOTES_MARKER = "— Brouillon IA —";

/**
 * Notes du devis après l'IA : les notes écrites à la main sont conservées,
 * le bloc IA précédent est remplacé. Limité à 5000 caractères.
 */
export function mergeNotes(existing: string, draft: QuoteDraft): string {
  const manual = existing.split(AI_NOTES_MARKER)[0].trim();
  const block = [
    AI_NOTES_MARKER,
    draft.transcription && `Transcription de la note vocale :\n${draft.transcription}`,
    draft.assumptions.length > 0 && `À vérifier :\n${draft.assumptions.map((a) => `- ${a}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return [manual, block].filter(Boolean).join("\n\n").slice(0, 5000);
}
