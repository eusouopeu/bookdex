/**
 * Cliente da API da Anthropic.
 *
 * Chamada direta do browser: a chave fica só neste aparelho (localStorage,
 * via storage.js) e nunca no código-fonte.
 * `anthropic-dangerous-direct-browser-access: true` é obrigatório para
 * chamadas feitas direto do browser — sem ele a API recusa a requisição.
 *
 * Plano B (opcional): se o usuário configurar uma URL de proxy em
 * Configurações, a requisição vai para lá em vez de api.anthropic.com.
 */
import { get, set, KEYS } from "./storage";
import { MODELS } from "./models";
import { assertWithinBudget, trackUsage } from "./usage";

const API_URL = "https://api.anthropic.com/v1/messages";

export class MissingApiKeyError extends Error {
  constructor() {
    super("Nenhuma API key configurada.");
    this.name = "MissingApiKeyError";
  }
}

export async function getApiKey() {
  const res = await get(KEYS.apiKey);
  return res && res.value ? res.value : "";
}

export async function setApiKey(key: string) {
  await set(KEYS.apiKey, (key || "").trim());
}

export async function getProxyUrl() {
  const res = await get(KEYS.proxyUrl);
  return res && res.value ? res.value : "";
}

export async function setProxyUrl(url: string) {
  await set(KEYS.proxyUrl, (url || "").trim());
}

export async function hasCredentials() {
  const [key, proxy] = await Promise.all([getApiKey(), getProxyUrl()]);
  return !!(key || proxy);
}

/**
 * "auto" (padrão) manda `thinking: adaptive` — mais criterioso, mais lento e
 * mais caro. "fast" tira o pensamento estendido: mesmo modelo (Sonnet), só
 * mais rápido e mais barato — útil pra quem usa o app bastante e não precisa
 * do raciocínio extra em toda avaliação/sugestão.
 */
export async function getThinkingMode() {
  const res = await get(KEYS.thinkingMode);
  return res && res.value === "fast" ? "fast" : "auto";
}

export async function setThinkingMode(mode: string) {
  await set(KEYS.thinkingMode, mode === "fast" ? "fast" : "auto");
}

export function looksLikeApiKey(key?: string) {
  return /^sk-ant-[\w-]{10,}$/.test((key || "").trim());
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Formato inesperado");
  return text.slice(start, end + 1);
}

/** Envia uma mensagem e devolve o texto concatenado dos blocos de resposta. */
export async function sendMessage({
  system,
  user,
  maxTokens = 1000,
  effort = "medium",
  model = MODELS.sonnet,
}: {
  system: string;
  user: string;
  maxTokens?: number;
  effort?: string;
  model?: string;
}) {
  await assertWithinBudget();
  const [apiKey, proxyUrl, thinkingMode] = await Promise.all([getApiKey(), getProxyUrl(), getThinkingMode()]);
  if (!apiKey && !proxyUrl) throw new MissingApiKeyError();

  const url = proxyUrl || API_URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!proxyUrl) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const body: any = {
    model,
    max_tokens: maxTokens,
    system,
    output_config: { effort },
    messages: [{ role: "user", content: user }],
  };
  if (thinkingMode !== "fast") body.thinking = { type: "adaptive" };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Falha de rede ao falar com a API. Verifique a conexão (ou configure um proxy em Configurações).");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err?.error?.message || "";
    } catch {
      /* corpo não-JSON */
    }
    if (response.status === 401) throw new Error("API key inválida ou expirada. Confira em Configurações.");
    if (response.status === 429) throw new Error("Limite de uso da API atingido. Tente de novo em instantes.");
    throw new Error(`Erro ${response.status} da API${detail ? `: ${detail}` : "."}`);
  }

  const data = await response.json();
  trackUsage(data.model || model, data.usage).catch(() => {});
  return (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

/** Igual a sendMessage, mas já devolve o JSON da resposta parseado. */
export async function sendMessageJSON(opts: any) {
  const text = await sendMessage(opts);
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(extractJson(cleaned));
}
