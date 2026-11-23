export const FIELDS = [
  "name",
  "street",
  "postalCity",
  "phone",
  "email",
  "website",
  "vatNumber",
  "iban",
  "validityDays",
  "paymentTerms",
  "footerNote",
] as const;

export type FieldName = (typeof FIELDS)[number];

export interface CompanyFormState {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
  /** Valeurs affichées (saisie conservée en cas d'erreur). */
  values: Record<FieldName, string>;
  /** Horodatage de la réponse (0 au rendu initial) ; sert à détecter une nouvelle réponse. */
  at: number;
}

export interface LogoState {
  ok: boolean;
  /** Message d'état général, annoncé dans la région `role="status"`. */
  message: string;
  /** Refus lié au fichier choisi, affiché sous le champ fichier. */
  fieldError?: string;
  at: number;
}

export const INITIAL_LOGO_STATE: LogoState = { ok: false, message: "", at: 0 };
