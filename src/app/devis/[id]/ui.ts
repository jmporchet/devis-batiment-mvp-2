/*
 * Classes partagées de la relecture. Le contour de focus vient de globals.css
 * (:focus-visible) : ne pas le supprimer ici. Bordures à fort contraste
 * (stone-500, 4,7:1 sur blanc) pour que les champs restent repérables.
 */
export const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-stone-500 bg-white px-3 text-base text-stone-900 aria-[invalid=true]:border-red-700";
export const buttonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50 aria-disabled:opacity-50";
export const secondaryButtonClass = `${buttonClass} border border-stone-500 bg-white text-stone-900`;
export const primaryButtonClass = `${buttonClass} bg-stone-900 text-white`;
