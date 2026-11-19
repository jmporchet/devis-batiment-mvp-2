"use client";

import { useActionState } from "react";
import { INITIAL_LOGO_STATE } from "./action-state";
import { logoAction } from "./actions";

export function LogoSection({ hasLogo, version }: { hasLogo: boolean; version: number }) {
  const [state, formAction, pending] = useActionState(logoAction, INITIAL_LOGO_STATE);

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
      <form action={formAction} className="flex flex-col gap-2">
        <label htmlFor="logo" className="text-sm font-medium">
          {hasLogo ? "Remplacer le logo" : "Ajouter un logo"}
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          className="min-h-11 w-full text-base file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-stone-300 file:bg-stone-100 file:px-4 file:text-base file:font-medium"
        />
        <p className="text-sm text-stone-600">PNG ou JPEG, 1 Mo maximum, de préférence sur fond blanc ou transparent.</p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-stone-900 px-4 text-base font-medium text-white active:bg-stone-700 disabled:opacity-60"
        >
          {pending ? "Traitement…" : "Envoyer le logo"}
        </button>
      </form>
      {hasLogo && (
        <form action={formAction}>
          <input type="hidden" name="intent" value="remove" />
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-4 text-base font-medium text-stone-900 active:bg-stone-100 disabled:opacity-60"
          >
            Retirer le logo
          </button>
        </form>
      )}
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-medium text-green-800" : "text-sm font-medium text-red-700"}>
          {state.message}
        </p>
      )}
    </section>
  );
}
