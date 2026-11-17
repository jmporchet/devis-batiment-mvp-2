import type { QuoteInfo, QuoteLine, QuoteStatus } from "@/domain/types";

/** Résultat d'une Server Action de la relecture, sérialisable. */
export type ActionResult =
  | { ok: true; status: QuoteStatus; info: QuoteInfo; lines: QuoteLine[] }
  | { ok: false; message: string; fieldErrors: Record<string, string> };
