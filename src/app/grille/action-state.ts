export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
}

export const INITIAL_STATE: ActionState = { ok: false, message: "", fieldErrors: {} };
