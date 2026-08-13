/**
 * Cliente da API da Anthropic.
 *
 * Fora do sandbox do claude.ai não existe proxy autenticado: a chamada precisa
 * levar a chave do próprio usuário. A chave é guardada localmente via storage.js
 * e NUNCA fica no código-fonte.
 *
 * `anthropic-dangerous-direct-browser-access: true` é obrigatório para chamadas
 * feitas direto do browser/WebView — sem ele a API recusa a requisição.
 *
 * Plano B (opcional): se o usuário configurar uma URL de proxy em Configurações,
 * a requisição vai para lá em vez de api.anthropic.com. Ver README.
 */
import { get, set, getJSON, setJSON, KEYS } from "./storage";

// Sempre Sonnet, esforço médio, com thinking adaptativo ligado.
export const MODEL = "claude-sonnet-5";
const EFFORT = "medium";
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

export async function setApiKey(key) {
  await set(KEYS.apiKey, (key || "").trim());
}

export async function getProxyUrl() {
  const res = await get(KEYS.proxyUrl);
  return res && res.value ? res.value : "";
}

export async function setProxyUrl(url) {
  await set(KEYS.proxyUrl, (url || "").trim());
}

export async function hasCredentials() {
  const [key, proxy] = await Promise.all([getApiKey(), getProxyUrl()]);
  return !!(key || proxy);
}

export function looksLikeApiKey(key) {
  return /^sk-ant-[\w-]{10,}$/.test((key || "").trim());
}

const EMPTY_USAGE = { calls: 0, inputTokens: 0, outputTokens: 0, since: null };

export async function getUsageStats() {
  return await getJSON(KEYS.usageStats, EMPTY_USAGE);
}

export async function resetUsageStats() {
  await setJSON(KEYS.usageStats, { ...EMPTY_USAGE, since: Date.now() });
}

async function trackUsage(usage) {
  if (!usage) return;
  const current = await getUsageStats();
  await setJSON(KEYS.usageStats, {
    calls: (current.calls || 0) + 1,
    inputTokens: (current.inputTokens || 0) + (usage.input_tokens || 0),
    outputTokens: (current.outputTokens || 0) + (usage.output_tokens || 0),
    since: current.since || Date.now(),
  });
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Formato inesperado");
  return text.slice(start, end + 1);
}

/**
 * Envia uma mensagem e devolve o texto concatenado dos blocos de resposta.
 */
export async function sendMessage({ system, user, maxTokens = 1000 }) {
  const [apiKey, proxyUrl] = await Promise.all([getApiKey(), getProxyUrl()]);
  if (!apiKey && !proxyUrl) throw new MissingApiKeyError();

  const url = proxyUrl || API_URL;
  const headers = { "Content-Type": "application/json" };
  if (!proxyUrl) {
    // Chamada direta: a key vai no header, e o header de browser direto é obrigatório.
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (apiKey) {
    // Proxy que repassa a key do usuário (proxies que guardam a key no servidor
    // simplesmente ignoram este header).
    headers["x-api-key"] = apiKey;
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    throw new Error(
      "Falha de rede ao falar com a API. Verifique a conexão (ou configure um proxy em Configurações)."
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err?.error?.message || "";
    } catch {
      /* corpo não-JSON */
    }
    if (response.status === 401) {
      throw new Error("API key inválida ou expirada. Confira em Configurações.");
    }
    if (response.status === 429) {
      throw new Error("Limite de uso da API atingido. Tente de novo em instantes.");
    }
    throw new Error(`Erro ${response.status} da API${detail ? `: ${detail}` : "."}`);
  }

  const data = await response.json();
  trackUsage(data.usage).catch(() => {});
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * Igual a sendMessage, mas já devolve o JSON da resposta parseado.
 */
export async function sendMessageJSON(opts) {
  const text = await sendMessage(opts);
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(extractJson(cleaned));
}

/* Prompts ----------------------------------------------------------------- */

export const SEARCH_SYSTEM_PROMPT = `Você gera conteúdo para um app estilo Pokédex sobre técnicas de estudo/saúde/habilidades.
Dado um assunto em português, retorne EXATAMENTE 6 técnicas ou tipos relacionados a esse assunto, comparados entre si.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- Defina exatamente 4 categorias de comparação (statLabels), curtas (1-2 palavras cada), relevantes ao assunto.
- Para cada técnica, dê notas de 1 a 5 nas 4 categorias, de forma COMPARATIVA entre as 6 técnicas: use toda a escala (a melhor da lista naquele quesito recebe 5, a pior recebe 1 ou 2). Não repita a mesma nota para todas as técnicas.
- "description": no máximo 20 palavras, em português, direto.
- "bestFor": no máximo 8 palavras, situação ideal de uso.
- "type": 1 a 2 palavras, categoria/estilo da técnica (como um "tipo" de Pokémon).
- "name": nome da técnica em português.
- "subjectIntro": 1 frase, no máximo 15 palavras.

Formato exato (sem campos extras):
{"subject":"Nome do Assunto","subjectIntro":"...","statLabels":["a","b","c","d"],"techniques":[{"name":"...","type":"...","description":"...","bestFor":"...","stats":[1,2,3,4]}]}`;

export const DETAIL_SYSTEM_PROMPT = `Você escreve guias práticos, curtos e aplicáveis para um app estilo Pokédex de técnicas.
Dado o nome de uma técnica e o assunto a que ela pertence, produza um guia passo a passo em português.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "overview": 1 a 2 frases explicando o que a técnica faz e por que funciona.
- "steps": de 4 a 6 passos na ordem de execução. Cada passo tem "title" (até 5 palavras) e "detail" (até 25 palavras, instrução concreta e acionável).
- "rightSigns": 3 sinais de que está sendo feito CERTO (até 12 palavras cada).
- "wrongSigns": 3 sinais de que está sendo feito ERRADO, com o ajuste implícito (até 14 palavras cada).
- "tip": 1 frase, dica avançada ou erro comum a evitar (até 20 palavras).
- Nada de genéricos vazios: seja específico e observável.

Formato exato (sem campos extras):
{"overview":"...","steps":[{"title":"...","detail":"..."}],"rightSigns":["..."],"wrongSigns":["..."],"tip":"..."}`;

export const DEFINITION_SYSTEM_PROMPT = `Você gera conteúdo para um app estilo Pokédex de conhecimento.
Dado um termo ou conceito em português, explique-o com clareza, como um verbete de enciclopédia aplicado a estudo/saúde/habilidades.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "term": o termo/conceito buscado, capitalizado corretamente.
- "category": 1 a 2 palavras, a área/campo do conceito (como um "tipo" de Pokémon; ex.: "Biologia", "Finanças", "Psicologia").
- "subjectIntro": 1 frase, no máximo 15 palavras, introduzindo o conceito.
- "definition": explicação clara e completa em 2 a 4 frases, em português.
- "keyPoints": 3 a 5 pontos-chave curtos (até 12 palavras cada).
- "example": 1 frase com um exemplo prático de aplicação do conceito.
- "relatedTerms": 3 a 5 termos relacionados, curtos (1 a 3 palavras cada).

Formato exato (sem campos extras):
{"term":"...","category":"...","subjectIntro":"...","definition":"...","keyPoints":["..."],"example":"...","relatedTerms":["..."]}`;

export const LIST_SYSTEM_PROMPT = `Você gera conteúdo para um app estilo Pokédex de conhecimento.
Dado um assunto em português, retorne uma enumeração dos tipos, categorias ou variações relacionadas a esse assunto.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "subject": nome do assunto/categoria enumerada.
- "subjectIntro": 1 frase, no máximo 15 palavras.
- "items": entre 5 e 10 itens. Cada item tem "name" (1 a 4 palavras), "category" (1 a 2 palavras, como um "tipo" de Pokémon) e "description" (no máximo 20 palavras, direto).

Formato exato (sem campos extras):
{"subject":"...","subjectIntro":"...","items":[{"name":"...","category":"...","description":"..."}]}`;

export async function fetchTechniques(subject) {
  const parsed = await sendMessageJSON({
    system: SEARCH_SYSTEM_PROMPT,
    user: subject,
    maxTokens: 1000,
  });
  if (!parsed.subject || !Array.isArray(parsed.statLabels) || !Array.isArray(parsed.techniques)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchDefinition(term) {
  const parsed = await sendMessageJSON({
    system: DEFINITION_SYSTEM_PROMPT,
    user: term,
    maxTokens: 900,
  });
  if (!parsed.term || !parsed.definition) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchList(subject) {
  const parsed = await sendMessageJSON({
    system: LIST_SYSTEM_PROMPT,
    user: subject,
    maxTokens: 1000,
  });
  if (!parsed.subject || !Array.isArray(parsed.items)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchDetail(subjectDisplay, technique) {
  const parsed = await sendMessageJSON({
    system: DETAIL_SYSTEM_PROMPT,
    user: `Assunto: ${subjectDisplay}\nTécnica: ${technique.name}\nTipo: ${technique.type}\nResumo: ${technique.description}`,
    maxTokens: 1200,
  });
  if (!parsed.overview || !Array.isArray(parsed.steps)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}
