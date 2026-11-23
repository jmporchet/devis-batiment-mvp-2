import type { Ref } from "react";

/**
 * Région d'erreur toujours rendue : le conteneur `role="alert"` existe avant
 * le message, dont le texte change (une région qui apparaît n'est pas
 * annoncée de façon fiable). Le message commence par l'icône « Erreur » et
 * dit comment corriger. `tabIndex={-1}` permet d'y amener le focus après un
 * refus.
 */
export function ErrorRegion({ message, ref }: { message: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={message ? "flex items-start gap-2 rounded-lg border border-red-700 bg-red-50 p-3 text-sm text-red-900" : undefined}
    >
      {message ? (
        <>
          <span role="img" aria-label="Erreur">
            ⚠
          </span>
          <p>{message}</p>
        </>
      ) : null}
    </div>
  );
}
