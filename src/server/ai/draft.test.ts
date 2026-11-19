import { describe, expect, it } from "vitest";
import type { PriceItem } from "@/domain/types";
import {
  audioFormat,
  buildDraftMessages,
  DRAFT_RESPONSE_FORMAT,
  gridForPrompt,
  mergeNotes,
  parseDraftResponse,
} from "./draft";

const grid: PriceItem[] = [
  { id: "CAR-010", label: "Carrelage de sol, fourniture et pose", unit: "m2", unitPriceCents: 13_500, category: "carrelage", active: true },
  { id: "DEM-010", label: "Démolition revêtement de sol", unit: "m2", unitPriceCents: 4_800, category: "demolition", active: true },
  { id: "OLD-010", label: "Poste désactivé", unit: "pce", unitPriceCents: 100, category: "divers", active: false },
];

const reply = (obj: unknown) => JSON.stringify(obj);

describe("gridForPrompt", () => {
  it("liste code, libellé et unité des postes actifs, sans prix", () => {
    const text = gridForPrompt(grid);
    expect(text).toContain("CAR-010 | Carrelage de sol, fourniture et pose | m² (m2)");
    expect(text).not.toContain("OLD-010");
    expect(text).not.toMatch(/135|CHF/);
  });
});

describe("buildDraftMessages", () => {
  it("joint l'audio et les photos au message utilisateur", () => {
    const [system, user] = buildDraftMessages({
      title: "SdB",
      notes: "",
      priceItems: grid,
      media: [
        { kind: "photo", mimeType: "image/jpeg", base64: "AAA" },
        { kind: "audio", mimeType: "audio/webm", base64: "BBB" },
      ],
    });
    expect(system.content).toMatch(/Tu ne fixes aucun prix/);
    const parts = user.content as { type: string }[];
    expect(parts.map((p) => p.type)).toEqual(["text", "input_audio", "image_url"]);
    expect(parts[1]).toMatchObject({ input_audio: { data: "BBB", format: "webm" } });
    expect(parts[2]).toMatchObject({ image_url: { url: "data:image/jpeg;base64,AAA" } });
  });

  it("impose un schéma strict", () => {
    expect(DRAFT_RESPONSE_FORMAT.json_schema.strict).toBe(true);
  });
});

describe("audioFormat", () => {
  it.each([
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/mpeg", "mp3"],
    ["audio/ogg", "ogg"],
  ])("%s → %s", (mime, format) => expect(audioFormat(mime)).toBe(format));
});

describe("parseDraftResponse", () => {
  it("reprend libellé, unité et prix de la grille, jamais ceux du modèle", () => {
    const draft = parseDraftResponse(
      reply({
        transcription: " Salle de bain 6 m² ",
        titre: "Rénovation SdB",
        lignes: [{ code: "car-010", libelle: "carrelage pas cher", unite: "pce", quantite: 6.456 }],
        hypotheses: [],
      }),
      grid,
    );
    expect(draft.transcription).toBe("Salle de bain 6 m²");
    expect(draft.lines).toEqual([
      {
        priceItemId: "CAR-010",
        label: "Carrelage de sol, fourniture et pose",
        unit: "m2",
        quantity: 6.46,
        unitPriceCents: 13_500,
        source: "ai",
      },
    ]);
  });

  it("transforme un code inconnu, désactivé ou absent en ligne à chiffrer", () => {
    const draft = parseDraftResponse(
      reply({
        transcription: "",
        titre: "",
        lignes: [
          { code: null, libelle: "Niche murale", unite: "pce", quantite: 1 },
          { code: "XYZ-999", libelle: "Truc inventé", unite: "m2", quantite: 3 },
          { code: "OLD-010", libelle: "Ancien poste", unite: "km", quantite: 2 },
          { code: null, libelle: "  ", unite: "pce", quantite: 1 },
        ],
        hypotheses: ["DEM-010 : surface estimée"],
      }),
      grid,
    );
    expect(draft.lines.map((l) => [l.priceItemId, l.label, l.unit, l.unitPriceCents])).toEqual([
      [null, "Niche murale", "pce", null],
      [null, "Truc inventé", "m2", null],
      [null, "Ancien poste", "forfait", null],
    ]);
    expect(draft.assumptions).toEqual([
      "DEM-010 : surface estimée",
      "Code XYZ-999 inconnu dans la grille : ligne « Truc inventé » à chiffrer.",
      "Code OLD-010 inconnu dans la grille : ligne « Ancien poste » à chiffrer.",
    ]);
  });

  it("remplace une quantité absurde par 1 et le signale", () => {
    const draft = parseDraftResponse(
      reply({ transcription: "", titre: "", lignes: [{ code: "DEM-010", libelle: "", unite: "m2", quantite: -4 }], hypotheses: [] }),
      grid,
    );
    expect(draft.lines[0].quantity).toBe(1);
    expect(draft.assumptions[0]).toMatch(/DEM-010 : quantité proposée invalide/);
  });

  it("accepte un JSON entouré de ``` et refuse un texte libre", () => {
    const fenced = "```json\n" + reply({ transcription: "", titre: "", lignes: [], hypotheses: [] }) + "\n```";
    expect(parseDraftResponse(fenced, grid).lines).toEqual([]);
    expect(() => parseDraftResponse("Voici le devis : …", grid)).toThrow(/non conforme/);
  });
});

describe("mergeNotes", () => {
  const draft = { transcription: "Douche italienne", title: "", lines: [], assumptions: ["CAR-010 : surface estimée"] };

  it("garde les notes manuelles et remplace le bloc IA précédent", () => {
    const first = mergeNotes("Client absent le mardi", draft);
    expect(first).toBe(
      "Client absent le mardi\n\n— Brouillon IA —\n\nTranscription de la note vocale :\nDouche italienne\n\nÀ vérifier :\n- CAR-010 : surface estimée",
    );
    const second = mergeNotes(first, { ...draft, transcription: "Nouvelle note", assumptions: [] });
    expect(second).toBe("Client absent le mardi\n\n— Brouillon IA —\n\nTranscription de la note vocale :\nNouvelle note");
  });
});
