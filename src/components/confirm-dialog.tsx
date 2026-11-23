"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Action destructive : bouton rouge, focus initial sur « Annuler ». */
  destructive?: boolean;
}

/**
 * Confirmation dans un <dialog> modal natif (remplace window.confirm).
 * Le navigateur fournit la page inerte, le piège de focus, Échap et le
 * geste retour, et rend le focus au déclencheur à la fermeture.
 *
 *   const [dialog, confirm] = useConfirm();
 *   if (await confirm({ title: "Supprimer ?", confirmLabel: "Supprimer", destructive: true })) …
 *   return <>{…}{dialog}</>;
 */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const titleId = useId();
  const messageId = useId();

  const confirm = useCallback((next: ConfirmOptions) => {
    resolveRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      // Ouverture après le rendu du nouveau contenu.
      requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        if (!dialog) return resolve(false);
        dialog.returnValue = "";
        if (!dialog.open) dialog.showModal();
        // Destructif : focus sur l'action sûre ; sinon sur l'action principale.
        (next.destructive ? cancelRef : confirmRef).current?.focus();
      });
    });
  }, []);

  function handleClose() {
    const dialog = dialogRef.current;
    // Échap et le geste retour ne posent pas de valeur : « '' » = annulé.
    const ok = dialog?.returnValue === "confirm";
    if (dialog) dialog.returnValue = "";
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }

  const element = (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      aria-labelledby={titleId}
      aria-describedby={options?.message ? messageId : undefined}
      className="confirm-dialog m-auto w-[min(100%-2rem,28rem)] rounded-xl bg-white p-5 text-stone-900 shadow-xl"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {options?.title}
      </h2>
      {options?.message && (
        <p id={messageId} className="mt-2 text-stone-700">
          {options.message}
        </p>
      )}
      <form method="dialog" className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          ref={cancelRef}
          value="cancel"
          className="min-h-12 rounded-lg border border-stone-400 bg-white px-4 font-medium active:bg-stone-100"
        >
          {options?.cancelLabel ?? "Annuler"}
        </button>
        <button
          ref={confirmRef}
          value="confirm"
          className={`min-h-12 rounded-lg px-4 font-medium text-white ${
            options?.destructive ? "bg-red-700 active:bg-red-800" : "bg-stone-900 active:bg-stone-700"
          }`}
        >
          {options?.confirmLabel}
        </button>
      </form>
    </dialog>
  );

  return [element, confirm];
}
