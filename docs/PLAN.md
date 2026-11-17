# Plan du MVP

## Principe

L'IA ne calcule jamais un prix. Elle lit les photos et la transcription, puis propose des postes choisis dans la grille de l'entreprise (identifiant, quantité, unité). Le code calcule les montants HT, la TVA à 8,1 % et le TTC arrondi aux 5 centimes. Un travail absent de la grille apparaît « à chiffrer », sans prix inventé. Le chef de chantier relit et corrige toujours le devis avant de générer le PDF.

## Stack

Next.js 16 (App Router, TypeScript) et Tailwind, application web mobile-first servie par un serveur Node local. SQLite via better-sqlite3 et Drizzle ; photos et audio stockés sur le disque local (`data/`). Une seule entreprise. Transcription vocale derrière une interface interchangeable. Structuration du devis par Claude Sonnet avec sortie JSON validée par schéma (zod). PDF avec @react-pdf/renderer. Tests Vitest, CI GitHub Actions.

## Conventions

Tous les montants sont des entiers en centimes. Les taux sont en points de base (8,1 % = 810). Les quantités ont au maximum 2 décimales. Les types partagés vivent dans `src/domain/types.ts`. L'interface est en français (fr-CH).

## Étapes

| # | PR | Contenu |
|---|---|---|
| 1 | Socle | Projet, SQLite + migrations, Vitest, CI, types du domaine |
| 2 | Moteur de calcul | HT, TVA, TTC, arrondi 5 ct, tests |
| 3 | Grille de prix | Postes de départ (Suisse romande), écran d'édition |
| 4 | Capture mobile | 3 photos + enregistrement d'environ 30 s |
| 5 | Brouillon IA | Transcription, structuration, postes « à chiffrer » |
| 6 | Relecture | Édition des lignes, recalcul en direct |
| 7 | PDF | En-tête entreprise, n° IDE/TVA, validité, conditions |
| 8 | Finitions | Accès protégé, jeu de 10 dictées test |
