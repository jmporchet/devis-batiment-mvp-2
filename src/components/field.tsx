"use client";

import { useId, type FormEvent, type ReactNode } from "react";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Props à étaler sur le contrôle (input, select…) rendu par `Field`. */
export interface FieldControlProps {
  id: string;
  name: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid": boolean;
  /** Id du message d'erreur client, relié par le script `UserInvalidAria`. */
  "data-error": string;
  onInvalid: (event: FormEvent<Control>) => void;
  onInput: (event: FormEvent<Control>) => void;
  className: string;
}

export const controlClass =
  "min-h-12 w-full rounded-lg border border-stone-500 bg-white px-3 text-stone-900";

/**
 * Champ de formulaire accessible : libellé au-dessus, aide au-dessus du
 * contrôle (le clavier mobile ne la masque pas), erreur affichée seulement
 * après interaction grâce à :user-invalid, erreur serveur reliée par
 * aria-describedby.
 */
export function Field({
  name,
  label,
  hint,
  error,
  serverError,
  required = false,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  /** Message affiché si la validation native échoue. Dit comment corriger. */
  error: string;
  /** Message renvoyé par le serveur pour ce champ. */
  serverError?: string;
  required?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const serverErrorId = `${id}-server-error`;
  const describedBy = [hint && hintId, serverError && serverErrorId].filter(Boolean).join(" ");

  return (
    <div className="field flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-stone-600">
          {hint}
        </p>
      )}
      {children({
        id,
        name,
        required,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": Boolean(serverError),
        "data-error": errorId,
        // Message du navigateur aligné sur notre texte d'erreur.
        onInvalid: (event) => event.currentTarget.setCustomValidity(error),
        onInput: (event) => event.currentTarget.setCustomValidity(""),
        className: controlClass,
      })}
      <p id={errorId} data-client className="field-error items-start gap-1 text-sm text-red-700">
        <ErrorIcon />
        {error}
      </p>
      {serverError && (
        <p id={serverErrorId} data-server className="field-error items-start gap-1 text-sm text-red-700">
          <ErrorIcon />
          {serverError}
        </p>
      )}
    </div>
  );
}

function ErrorIcon() {
  return (
    <span role="img" aria-label="Erreur">
      ⚠
    </span>
  );
}
