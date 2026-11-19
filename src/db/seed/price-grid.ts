/**
 * GRILLE DE DÉPART FICTIVE, À VALIDER PAR LA PME.
 *
 * Ces postes et ces prix sont des ordres de grandeur plausibles pour la
 * Suisse romande en 2026 (prix HT, en centimes de CHF). Ils servent à
 * démarrer : l'entreprise doit les relire et les ajuster à ses propres
 * tarifs depuis l'écran « Ma grille de prix » avant tout usage réel.
 *
 * Codes : préfixe de catégorie (DEM, MAC, CAR, SAN, PEI, ELE, MEN, DIV) et
 * trois chiffres, de 10 en 10 pour pouvoir insérer des postes intermédiaires.
 * Un code publié ne change jamais : les devis existants le référencent.
 */
import type { Category, Unit } from "@/domain/types";

export interface SeedPriceItem {
  id: string;
  label: string;
  unit: Unit;
  unitPriceCents: number;
  category: Category;
}

export const PRICE_GRID_SEED: readonly SeedPriceItem[] = [
  // Démolition et évacuation
  { id: "DEM-010", category: "demolition", unit: "m2", unitPriceCents: 4_800, label: "Démolition du revêtement de sol existant (carrelage, y c. mortier de pose)" },
  { id: "DEM-020", category: "demolition", unit: "m2", unitPriceCents: 4_200, label: "Démolition du revêtement mural existant (faïence, y c. colle)" },
  { id: "DEM-030", category: "demolition", unit: "pce", unitPriceCents: 38_000, label: "Dépose de baignoire existante, y c. coupe et évacuation" },
  { id: "DEM-040", category: "demolition", unit: "pce", unitPriceCents: 15_000, label: "Dépose d'un appareil sanitaire existant (WC ou lavabo)" },
  { id: "DEM-050", category: "demolition", unit: "m3", unitPriceCents: 22_000, label: "Évacuation des gravats, y c. taxe de décharge" },
  { id: "DEM-060", category: "demolition", unit: "forfait", unitPriceCents: 35_000, label: "Protection de chantier (sols, cage d'escalier, ascenseur, mobilier)" },

  // Maçonnerie et chapes
  { id: "MAC-010", category: "maconnerie", unit: "m2", unitPriceCents: 5_500, label: "Chape ciment de 5 cm, fourniture et pose" },
  { id: "MAC-020", category: "maconnerie", unit: "m2", unitPriceCents: 2_800, label: "Ragréage autolissant, fourniture et pose" },
  { id: "MAC-030", category: "maconnerie", unit: "m2", unitPriceCents: 4_800, label: "Étanchéité sous carrelage (système composite), fourniture et pose" },
  { id: "MAC-040", category: "maconnerie", unit: "ml", unitPriceCents: 2_200, label: "Bande d'étanchéité d'angle et de raccord, fourniture et pose" },
  { id: "MAC-050", category: "maconnerie", unit: "m2", unitPriceCents: 9_500, label: "Cloison en plaques de plâtre hydrofuges, fourniture et pose" },

  // Carrelage et faïence
  { id: "CAR-010", category: "carrelage", unit: "m2", unitPriceCents: 13_500, label: "Carrelage de sol en grès cérame, fourniture et pose" },
  { id: "CAR-020", category: "carrelage", unit: "m2", unitPriceCents: 7_500, label: "Carrelage de sol, pose seule (carreaux fournis par le client)" },
  { id: "CAR-030", category: "carrelage", unit: "m2", unitPriceCents: 12_500, label: "Faïence murale, fourniture et pose" },
  { id: "CAR-040", category: "carrelage", unit: "m2", unitPriceCents: 7_000, label: "Faïence murale, pose seule (carreaux fournis par le client)" },
  { id: "CAR-050", category: "carrelage", unit: "ml", unitPriceCents: 2_800, label: "Plinthe carrelée, fourniture et pose" },
  { id: "CAR-060", category: "carrelage", unit: "ml", unitPriceCents: 1_200, label: "Joint silicone sanitaire, fourniture et pose" },
  { id: "CAR-070", category: "carrelage", unit: "ml", unitPriceCents: 1_800, label: "Profilé de finition en aluminium ou inox, fourniture et pose" },

  // Installations sanitaires
  { id: "SAN-010", category: "sanitaire", unit: "pce", unitPriceCents: 260_000, label: "Douche à l'italienne avec caniveau, fourniture et pose (siphon, pente, hors carrelage)" },
  { id: "SAN-020", category: "sanitaire", unit: "pce", unitPriceCents: 115_000, label: "Paroi de douche en verre de sécurité 8 mm, fourniture et pose" },
  { id: "SAN-030", category: "sanitaire", unit: "pce", unitPriceCents: 165_000, label: "WC suspendu complet (bâti-support, cuvette, abattant, plaque), fourniture et pose" },
  { id: "SAN-040", category: "sanitaire", unit: "pce", unitPriceCents: 145_000, label: "Lavabo avec meuble sous-vasque, fourniture et pose" },
  { id: "SAN-050", category: "sanitaire", unit: "pce", unitPriceCents: 32_000, label: "Mitigeur de lavabo, fourniture et pose" },
  { id: "SAN-060", category: "sanitaire", unit: "pce", unitPriceCents: 68_000, label: "Mitigeur de douche thermostatique, fourniture et pose" },
  { id: "SAN-070", category: "sanitaire", unit: "forfait", unitPriceCents: 90_000, label: "Raccordements sanitaires (alimentation et évacuation de la pièce)" },
  { id: "SAN-080", category: "sanitaire", unit: "pce", unitPriceCents: 28_000, label: "Pose seule d'un appareil sanitaire fourni par le client" },

  // Peinture et plâtrerie
  { id: "PEI-010", category: "peinture", unit: "m2", unitPriceCents: 2_800, label: "Peinture de plafond, deux couches, préparation comprise" },
  { id: "PEI-020", category: "peinture", unit: "m2", unitPriceCents: 2_400, label: "Peinture de murs, deux couches, préparation comprise" },
  { id: "PEI-030", category: "peinture", unit: "m2", unitPriceCents: 2_200, label: "Enduit de lissage des murs avant peinture" },

  // Électricité
  { id: "ELE-010", category: "electricite", unit: "pce", unitPriceCents: 13_500, label: "Prise électrique, fourniture et pose" },
  { id: "ELE-020", category: "electricite", unit: "pce", unitPriceCents: 19_000, label: "Point lumineux (câblage, spot ou applique), fourniture et pose" },
  { id: "ELE-030", category: "electricite", unit: "pce", unitPriceCents: 12_000, label: "Interrupteur ou va-et-vient, fourniture et pose" },
  { id: "ELE-040", category: "electricite", unit: "pce", unitPriceCents: 48_000, label: "Ventilation de salle de bain (extracteur), fourniture et pose" },

  // Menuiserie
  { id: "MEN-010", category: "menuiserie", unit: "pce", unitPriceCents: 125_000, label: "Porte intérieure standard, fourniture et pose" },
  { id: "MEN-020", category: "menuiserie", unit: "ml", unitPriceCents: 2_200, label: "Plinthe bois ou MDF peinte, fourniture et pose" },
  { id: "MEN-030", category: "menuiserie", unit: "pce", unitPriceCents: 19_000, label: "Trappe de visite pour bâti ou baignoire, fourniture et pose" },

  // Divers
  { id: "DIV-010", category: "divers", unit: "h", unitPriceCents: 9_500, label: "Heure de régie, ouvrier qualifié" },
  { id: "DIV-020", category: "divers", unit: "h", unitPriceCents: 11_200, label: "Heure de régie, chef d'équipe" },
  { id: "DIV-030", category: "divers", unit: "forfait", unitPriceCents: 8_000, label: "Déplacement (Lausanne et agglomération)" },
  { id: "DIV-040", category: "divers", unit: "forfait", unitPriceCents: 42_000, label: "Nettoyage de fin de chantier" },
];
