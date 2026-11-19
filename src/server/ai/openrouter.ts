import "server-only";

/**
 * Client OpenRouter minimal (API compatible Chat Completions), sans SDK.
 * La clé est lue dans OPENROUTER_API_KEY (fichier .env.local, jamais commité).
 */

export const DEFAULT_MODEL = "google/gemini-3.8-flash";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 90_000;

/** Erreur d'appel IA, message prêt à afficher en français. */
export class AiError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "AiError";
  }
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  response_format?: unknown;
  temperature?: number;
  /** Routage OpenRouter : fournisseurs sans conservation des données. */
  provider?: { data_collection?: "deny" | "allow"; zdr?: boolean };
}

/**
 * Photos de logements et voix du chef de chantier : uniquement des
 * fournisseurs qui ne conservent pas les données et ne s'en servent pas pour
 * entraîner leurs modèles (zero data retention).
 */
export const PRIVATE_ROUTING = { data_collection: "deny", zdr: true } as const;

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage: ChatUsage;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function aiConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.OPENROUTER_API_KEY?.trim() || null;
  return { apiKey, model: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL };
}

export function isAiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return aiConfig(env).apiKey !== null;
}

export async function chatCompletion(
  request: ChatRequest,
  options: { apiKey: string; fetch?: FetchLike; timeoutMs?: number },
): Promise<ChatResult> {
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Devis chantier",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    throw new AiError(
      timeout
        ? "L'analyse a pris trop de temps. Réessayez dans un instant."
        : "Impossible de joindre le service d'IA. Vérifiez la connexion internet du serveur.",
      String(error),
    );
  }

  const text = await response.text();
  if (!response.ok) {
    throw new AiError(httpMessage(response.status), `${response.status} ${text.slice(0, 500)}`);
  }
  let json: {
    model?: string;
    usage?: ChatUsage;
    error?: { message?: string };
    choices?: { message?: { content?: string | null } }[];
  };
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("Réponse illisible du service d'IA.", text.slice(0, 500));
  }
  if (json.error) {
    throw new AiError("Le service d'IA a renvoyé une erreur. Réessayez.", json.error.message);
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new AiError("Le service d'IA n'a rien répondu. Réessayez.", text.slice(0, 500));
  return { content, model: json.model ?? request.model, usage: json.usage ?? {} };
}

function httpMessage(status: number): string {
  if (status === 401 || status === 403) return "Clé OpenRouter refusée. Vérifiez OPENROUTER_API_KEY.";
  if (status === 402) return "Crédit OpenRouter épuisé. Rechargez le compte ou augmentez la limite de la clé.";
  if (status === 429) return "Trop de demandes au service d'IA. Réessayez dans une minute.";
  if (status === 404) return "Aucun fournisseur sans conservation des données n'est disponible pour ce modèle. Changez OPENROUTER_MODEL.";
  if (status === 400 || status === 413) return "Le service d'IA a refusé la demande (fichier trop gros ou format non pris en charge).";
  return "Le service d'IA est indisponible. Réessayez dans un instant.";
}
