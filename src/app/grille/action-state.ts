export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
  /**
   * Valeurs saisies, renvoyées en cas d'erreur. React réinitialise le
   * formulaire après l'action : les champs repartent de ces valeurs au lieu
   * de perdre la saisie.
   */
  values?: Record<string, string>;
  /**
   * Horodatage de la réponse. Sert de `key` au formulaire : il est remonté
   * après chaque réponse, car React ne réapplique pas un `defaultValue`
   * modifié sur un <select> lors de sa réinitialisation automatique.
   */
  at: number;
}

export const INITIAL_STATE: ActionState = { ok: false, message: "", fieldErrors: {}, at: 0 };
