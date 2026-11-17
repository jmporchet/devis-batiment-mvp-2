import "server-only";
import { createDb, type Db } from "./create-db";

/**
 * Connexion SQLite partagée par le serveur local.
 *
 * Le fichier est créé au premier accès et les migrations sont appliquées
 * automatiquement. Chemin configurable via DATABASE_PATH.
 *
 * Attention (Next 16) : better-sqlite3 est synchrone. Dans un Server
 * Component, appeler `await connection()` (de "next/server") avant toute
 * lecture, sinon la requête s'exécute au prérendu.
 */
const globalForDb = globalThis as unknown as { __devisDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__devisDb) {
    globalForDb.__devisDb = createDb(
      process.env.DATABASE_PATH ?? "data/devis.sqlite",
    );
  }
  return globalForDb.__devisDb;
}
