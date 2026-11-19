<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Conventions du projet

- Lire `docs/PLAN.md` avant toute tâche.
- Montants : entiers en centimes (`Centimes`). Taux en points de base (TVA 8,1 % = `VAT_RATE_BP` = 810). Jamais de float pour l'argent.
- Types partagés : `src/domain/types.ts`. Ne pas les dupliquer.
- Base : `getDb()` depuis `src/db/client.ts` (serveur uniquement). Dans un Server Component, appeler `await connection()` de `next/server` avant une lecture SQLite (driver synchrone, sinon exécuté au prérendu).
- Schéma : `src/db/schema.ts`, puis `npm run db:generate` pour créer la migration dans `drizzle/` (à committer).
- Tests : `*.test.ts` à côté du code, `createDb(":memory:")` pour une base de test.
- Interface en français (fr-CH), mobile-first.
- Avant de pousser : `npm run check` et `npm run build`.
- Devis : accès aux données dans `src/db/quotes.ts` (`createQuote`, `getQuote`, `listQuotes`, `updateQuoteInfo`, `replaceQuoteLines`, `setQuoteStatus`, `deleteQuote`). Erreurs métier : `QuoteError` (message français + `fieldErrors`). Un devis validé n'est plus modifiable.
- Lignes de devis : libellé, unité et prix sont copiés depuis la grille à l'ajout (la grille peut changer ensuite). `unitPriceCents: null` = « à chiffrer ». Totaux : toujours `computeTotals` de `src/domain/pricing.ts`, côté client comme serveur.
- Médias : `createQuoteFromCapture` (`src/server/create-quote.ts`) pour créer un devis depuis la capture ; fichiers sur disque dans `MEDIA_DIR` (défaut `data/media`), type vérifié par signature. URL d'un média : `/devis/<id>/media/<mediaId>` (gère Range pour l'audio Safari).
- Server Actions : limite de corps à 40 Mo (`next.config.ts`) ; réduire les photos côté navigateur avant l'envoi.
- Brouillon IA : `src/server/ai/` (`draft.ts` pur et testé : prompt, schéma JSON, lecture de la réponse ; `generate-draft.ts` : orchestration ; `openrouter.ts` : client). Le modèle ne voit pas les prix et ne les fixe jamais. Routage privé obligatoire (`PRIVATE_ROUTING`). Clé dans `OPENROUTER_API_KEY` (`.env.local`), jamais dans le code.
- Une Server Action lancée depuis un `useEffect` doit passer par `useTransition` : sinon les mises à jour d'état préalables restent bloquées jusqu'à la fin de l'action.
- Entreprise (en-tête du PDF) : `src/db/company.ts` (`getCompany`, `updateCompany`, `getCompanyLogo`, `setCompanyLogo`). Une seule ligne, créée avec `DEMO_COMPANY` (fictif) au premier accès. Logo PNG ou JPEG ≤ 1 Mo, stocké en base, servi par `/entreprise/logo`.
- Route Handler sans paramètre dynamique qui lit la base : appeler `await connection()` en premier, sinon Next la pré-rend au build et fige la réponse.
- Suppression : seuls les brouillons (`deleteDraftQuote`, refus pour un devis validé). Côté serveur, `deleteDraftWithMedia` efface aussi les fichiers. `deleteQuote` reste réservé au nettoyage interne.
