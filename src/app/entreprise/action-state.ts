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
}

export interface LogoState {
  ok: boolean;
  message: string;
}

export const INITIAL_LOGO_STATE: LogoState = { ok: false, message: "" };
