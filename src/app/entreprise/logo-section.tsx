"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field } from "@/components/field";
import { useConfirm } from "@/components/confirm-dialog";
import { INITIAL_LOGO_STATE } from "./action-state";
import { logoAction } from "./actions";

const buttonClass = "min-h-12 rounded-lg px-4 text-base font-medium disabled:opacity-60";

export function LogoSection({ hasLogo, version }: { hasLogo: boolean; version: number }) {
  const [state, formAction, pending] = useActionState(logoAction, INITIAL_LOGO_STATE);
  const [dialog, confirm] = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  // Après un refus du fichier, le focus va au champ fichier.
  useEffect(() => {
    if (state.at === 0 || state.ok) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  // Le retrait demande confirmation ; l'envoi passe directement.
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value !== "remove" || confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    event.preventDefault();
    const ok = await confirm({
      title: "Retirer le logo ?",
      message: "Les prochains devis PDF n'afficheront plus de logo. Vous pourrez en ajouter un autre à tout moment.",
      confirmLabel: "Retirer le logo",
      destructive: true,
    });
    if (!ok) return;
    confirmedRef.current = true;
    formRef.current?.requestSubmit(submitter);
  }

  const status = pending ? "Traitement…" : state.message;

  return (
    <section aria-labelledby="logo-title" className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <h2 id="logo-title" className="text-lg font-semibold">
        Logo
      </h2>
      {hasLogo ? (
        <div className="flex min-h-24 items-center justify-center rounded-lg border border-stone-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo servi par une route, versionné par ?v= */}
          <img src={`/entreprise/logo?v=${version}`} alt="Logo actuel de l'entreprise" className="max-h-24 max-w-full object-contain" />
        </div>
      ) : (
        <p className="text-sm text-stone-600">Aucun logo pour le moment.</p>
      )}
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        aria-labelledby="logo-title"
        className="flex flex-col gap-3"
      >
        <Field
          name="logo"
          label={hasLogo ? "Remplacer le logo" : "Ajouter un logo"}
          hint="PNG ou JPEG, 1 Mo maximum, de préférence sur fond blanc ou transparent."
          error="Choisissez un fichier PNG ou JPEG de 1 Mo au maximum."
          serverError={state.fieldError}
        >
          {(control) => (
            <input
              {...control}
              key={state.at}
              type="file"
              accept="image/png,image/jpeg"
              className={`${control.className} py-2 file:mr-3 file:min-h-8 file:rounded-md file:border file:border-stone-400 file:bg-stone-100 file:px-3 file:font-medium`}
            />
          )}
        </Field>
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} bg-stone-900 text-white active:bg-stone-700`}
        >
          {pending ? "Traitement…" : "Envoyer le logo"}
        </button>
        {hasLogo && (
          <button
            type="submit"
            name="intent"
            value="remove"
            disabled={pending}
            className={`${buttonClass} border border-stone-500 bg-white text-stone-900 active:bg-stone-100`}
          >
            Retirer le logo
          </button>
        )}
      </form>
      <p role="status" className={`text-sm font-medium ${pending ? "text-stone-700" : state.ok ? "text-green-800" : "text-red-700"}`}>
        {status}
      </p>
      {dialog}
    </section>
  );
}
