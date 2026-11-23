"use client";

import { useEffect } from "react";

/**
 * Synchronise aria-invalid et aria-describedby avec l'état CSS :user-invalid,
 * et annonce une erreur apparue en quittant un champ via une seule région
 * live polie. :user-invalid ne met pas à jour l'ARIA tout seul.
 *
 * Un aria-invalid="true" posé par le rendu (erreur serveur) est laissé tel quel.
 * Monté une fois dans le layout ; écoute au niveau du document, donc couvre
 * aussi les formulaires rendus plus tard (Suspense, <details>).
 */
export function UserInvalidAria() {
  useEffect(() => {
    const announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.className = "visually-hidden";
    document.body.append(announcer);
    let announceTimer: ReturnType<typeof setTimeout> | undefined;
    let announcedField: Element | null = null;

    const isField = (el: EventTarget | null): el is HTMLInputElement =>
      el instanceof Element && el.matches("input, select, textarea");

    // Le message d'erreur n'est relié que lorsqu'il est affiché : un texte
    // référencé par aria-describedby est lu même s'il est masqué.
    const linkError = (el: HTMLElement, shown: boolean) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };

    const spokenText = (node: Element) => {
      const copy = node.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      copy
        .querySelectorAll("[role='img'][aria-label]")
        .forEach((n) => n.replaceWith(`${n.getAttribute("aria-label")} : `));
      return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
    };

    const announceError = (el: HTMLInputElement) => {
      const error = el.dataset.error ? document.getElementById(el.dataset.error) : null;
      if (!error) return;
      const label = el.labels?.[0] ? `${spokenText(el.labels[0])} : ` : "";
      clearTimeout(announceTimer);
      announcer.textContent = "";
      announcedField = el;
      // Laisse d'abord le lecteur d'écran annoncer le champ suivant.
      announceTimer = setTimeout(() => {
        announcer.textContent = label + spokenText(error);
      }, 500);
    };

    const flagged = new WeakSet<Element>();
    const announced = new WeakSet<Element>();

    const syncAria = (target: EventTarget | null, announce = false) => {
      if (!isField(target)) return;
      const el = target;
      if (el.matches(":user-invalid")) {
        if (announce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute("aria-invalid", "true");
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
        el.setAttribute("aria-invalid", "false");
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          clearTimeout(announceTimer);
          announcer.textContent = "";
        }
      }
    };

    const onBlur = (e: Event) => syncAria(e.target, true);
    const onInput = (e: Event) => {
      if (isField(e.target) && e.target.hasAttribute("aria-invalid")) syncAria(e.target);
    };
    const onChange = (e: Event) => syncAria(e.target, true);
    // Un envoi refusé déclenche « invalid » sur chaque champ fautif ; le focus
    // va au premier, qui annonce son erreur lui-même.
    const onInvalid = (e: Event) => {
      if (e.target instanceof Element) announced.add(e.target);
      syncAria(e.target);
    };
    const onReset = (e: Event) => {
      const form = e.target as HTMLFormElement;
      setTimeout(() => [...form.elements].forEach((el) => syncAria(el)));
    };

    document.querySelectorAll("input, select, textarea").forEach((el) => syncAria(el));
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange, true);
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("reset", onReset, true);

    return () => {
      clearTimeout(announceTimer);
      announcer.remove();
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("input", onInput);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("reset", onReset, true);
    };
  }, []);

  return null;
}
