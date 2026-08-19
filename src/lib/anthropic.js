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

// Sempre Sonnet, com thinking adaptativo ligado. O esforço de saída das buscas
// (técnicas/conceito/tipos/comparação) é configurável pelo usuário; o resto das
// chamadas (guias, aprofundamentos, sugestões) permanece fixo em "medium".
export const MODEL = "claude-sonnet-5";
const DEFAULT_EFFORT = "medium";
const API_URL = "https://api.anthropic.com/v1/messages";

export const SEARCH_EFFORT_OPTIONS = [
  { value: "low", label: "Baixo", hint: "mais rápido e barato — bom para explorar" },
  { value: "medium", label: "Médio", hint: "equilíbrio padrão" },
  { value: "high", label: "Alto", hint: "mais caprichado — bom para se aprofundar" },
];

export async function getSearchEffort() {
  const res = await get(KEYS.searchEffort);
  const value = res && res.value ? res.value : DEFAULT_EFFORT;
  return SEARCH_EFFORT_OPTIONS.some((o) => o.value === value) ? value : DEFAULT_EFFORT;
}

export async function setSearchEffort(effort) {
  await set(KEYS.searchEffort, effort);
}

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
export async function sendMessage({ system, user, maxTokens = 1000, effort = DEFAULT_EFFORT }) {
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
        output_config: { effort },
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

/**
 * Monta o prompt de sistema da busca de técnicas. Se `criteria` vier vazio,
 * a comparação por critérios (statLabels/stats) some inteiramente — nada é
 * inventado só pra preencher os cards. Se vier preenchido, os critérios
 * usados são EXATAMENTE os informados pelo usuário, na ordem dada.
 */
export function buildSearchSystemPrompt(criteria) {
  const clean = [...new Set((criteria || []).map((c) => c.trim()).filter(Boolean))];
  const statsRule = clean.length
    ? `- Use EXATAMENTE estas ${clean.length} categoria(s) de comparação (statLabels), nesta ordem, sem adicionar nem remover nenhuma: ${clean
        .map((c) => `"${c}"`)
        .join(", ")}.
- Para cada técnica, dê notas de 1 a 5 em cada categoria, de forma COMPARATIVA entre as 6 técnicas: use toda a escala (a melhor da lista naquele quesito recebe 5, a pior recebe 1 ou 2). Não repita a mesma nota para todas as técnicas.`
    : `- NÃO defina categorias de comparação e NÃO invente nenhum critério. "statLabels" deve ser um array vazio [] e "stats" de cada técnica também deve ser um array vazio [].`;

  return `Você gera conteúdo para um app estilo Pokédex sobre técnicas de estudo/saúde/habilidades.
Dado um assunto em português, retorne EXATAMENTE 6 técnicas ou tipos relacionados a esse assunto, comparados entre si.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
${statsRule}
- "description": no máximo 20 palavras, em português, direto.
- "bestFor": no máximo 8 palavras, situação ideal de uso.
- "type": 1 a 2 palavras, categoria/estilo da técnica (como um "tipo" de Pokémon).
- "name": nome da técnica em português.
- "subjectIntro": 1 frase, no máximo 15 palavras.

Formato exato (sem campos extras):
{"subject":"Nome do Assunto","subjectIntro":"...","statLabels":[...],"techniques":[{"name":"...","type":"...","description":"...","bestFor":"...","stats":[...]}]}`;
}

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

/** Monta o texto de personalização a partir do que o usuário já marcou como pouco relevante. */
function avoidNote(avoid) {
  const clean = [...new Set((avoid || []).filter(Boolean))];
  if (!clean.length) return "";
  return `\n\n[Preferências do usuário: ele já marcou os itens a seguir como pouco relevantes em buscas anteriores — evite repeti-los ou sugerir variações muito parecidas: ${clean.join(", ")}.]`;
}

export async function fetchTechniques(subject, avoid, criteria, effort) {
  const parsed = await sendMessageJSON({
    system: buildSearchSystemPrompt(criteria),
    user: subject + avoidNote(avoid),
    maxTokens: 1000,
    effort,
  });
  if (!parsed.subject || !Array.isArray(parsed.statLabels) || !Array.isArray(parsed.techniques)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchDefinition(term, avoid, effort) {
  const parsed = await sendMessageJSON({
    system: DEFINITION_SYSTEM_PROMPT,
    user: term + avoidNote(avoid),
    maxTokens: 900,
    effort,
  });
  if (!parsed.term || !parsed.definition) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchList(subject, avoid, effort) {
  const parsed = await sendMessageJSON({
    system: LIST_SYSTEM_PROMPT,
    user: subject + avoidNote(avoid),
    maxTokens: 1000,
    effort,
  });
  if (!parsed.subject || !Array.isArray(parsed.items)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

/**
 * Monta o prompt de sistema do modo "cmp:": compara EXATAMENTE os itens nomeados
 * pelo usuário entre si (ao contrário do modo "tec:", que gera 6 técnicas a partir
 * de um assunto). Reaproveita o mesmo formato de saída (statLabels/stats) para
 * reusar TechCard/StatBar na exibição.
 */
export function buildCompareSystemPrompt(names, criteria) {
  const clean = [...new Set((criteria || []).map((c) => c.trim()).filter(Boolean))];
  const statsRule = clean.length
    ? `- Use EXATAMENTE estas ${clean.length} categoria(s) de comparação (statLabels), nesta ordem, sem adicionar nem remover nenhuma: ${clean
        .map((c) => `"${c}"`)
        .join(", ")}.
- Dê notas de 1 a 5 em cada categoria, de forma COMPARATIVA entre os itens: use toda a escala (o melhor da lista naquele quesito recebe 5, o pior recebe 1 ou 2). Não repita a mesma nota para todos os itens.`
    : `- Escolha de 2 a 4 categorias de comparação (statLabels) relevantes para comparar esses itens especificamente, e dê notas de 1 a 5 em cada uma, de forma COMPARATIVA (não repita a mesma nota para todos os itens).`;

  return `Você gera uma comparação direta entre itens específicos nomeados pelo usuário, para um app estilo Pokédex.
Dada uma lista de ${names.length} itens (podem ser técnicas, suplementos, ferramentas, conceitos práticos etc.), compare-os EXATAMENTE entre si — não invente itens adicionais nem troque nenhum dos citados.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- Retorne EXATAMENTE ${names.length} entradas em "techniques", uma para cada item, na mesma ordem em que foram citados: ${names.map((n) => `"${n}"`).join(", ")}.
${statsRule}
- "description": no máximo 20 palavras, em português, direto.
- "bestFor": no máximo 8 palavras, situação ideal de uso desse item específico.
- "type": 1 a 2 palavras, categoria/estilo do item (como um "tipo" de Pokémon).
- "name": nome do item EXATAMENTE como foi citado (correção ortográfica leve é aceitável).
- "subject": um título curto para a comparação, ex.: "Nome1 vs Nome2".
- "subjectIntro": 1 frase, no máximo 15 palavras, contextualizando a comparação.

Formato exato (sem campos extras):
{"subject":"...","subjectIntro":"...","statLabels":[...],"techniques":[{"name":"...","type":"...","description":"...","bestFor":"...","stats":[...]}]}`;
}

export async function fetchCompare(names, avoid, criteria, effort) {
  const parsed = await sendMessageJSON({
    system: buildCompareSystemPrompt(names, criteria),
    user: names.join(" vs ") + avoidNote(avoid),
    maxTokens: 1000,
    effort,
  });
  if (!parsed.subject || !Array.isArray(parsed.statLabels) || !Array.isArray(parsed.techniques)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export const RELATED_SYSTEM_PROMPT = `Você sugere novos assuntos para o usuário explorar num app estilo Pokédex de técnicas/conceitos/tipos, a partir do que ele já capturou.
Dada uma lista de assuntos e itens já capturados pelo usuário, sugira de 4 a 8 assuntos RELACIONADOS que ele provavelmente ainda não tem, para incentivá-lo a continuar explorando.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- Não repita nenhum dos assuntos/itens já capturados que foram fornecidos.
- "term": nome do assunto a buscar, 1 a 4 palavras, em português.
- "mode": "technique" (comparação de técnicas), "definition" (conceito único) ou "list" (enumeração de tipos) — escolha o mais adequado ao termo.
- "reason": motivo curto (até 12 palavras) ligando a sugestão ao que o usuário já capturou.
- Priorize diversidade: não sugira 8 variações do mesmo assunto já capturado.

Formato exato (sem campos extras):
{"suggestions":[{"term":"...","mode":"...","reason":"..."}]}`;

export async function fetchRelatedSuggestions(capturedList) {
  const parsed = await sendMessageJSON({
    system: RELATED_SYSTEM_PROMPT,
    user: capturedList.join(", "),
    maxTokens: 700,
  });
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.suggestions;
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

export const STEP_DEEPDIVE_SYSTEM_PROMPT = `Você aprofunda UM passo específico de um guia de técnica, num app estilo Pokédex.
Dado o assunto, a técnica e um passo (título + instrução) já mostrados ao usuário, quebre esse passo em uma sub-lista mais granular, explicando COMO executá-lo na prática.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "substeps": de 3 a 5 itens, cada um até 16 palavras, concreto e acionável — mais específico que o passo original, sem repeti-lo literalmente.

Formato exato (sem campos extras):
{"substeps":["...","..."]}`;

export async function fetchStepDeepDive(subjectDisplay, technique, step) {
  const parsed = await sendMessageJSON({
    system: STEP_DEEPDIVE_SYSTEM_PROMPT,
    user: `Assunto: ${subjectDisplay}\nTécnica: ${technique.name}\nPasso: ${step.title}\nInstrução: ${step.detail}`,
    maxTokens: 500,
  });
  if (!Array.isArray(parsed.substeps)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.substeps;
}

export const CONCEPT_DEEPDIVE_SYSTEM_PROMPT = `Você aprofunda a explicação de um conceito/tipo já apresentado brevemente, num app estilo Pokédex de conhecimento.
Dado o termo, a categoria e a explicação resumida já mostrada ao usuário, gere um complemento MAIS profundo — sem repetir o que já foi dito.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "deepDive": 2 a 4 frases adicionais, em português, aprofundando mecanismos, nuances, contexto histórico ou aplicações não cobertas na explicação resumida.
- "extraPoints": 2 a 4 pontos adicionais e complementares (até 14 palavras cada), diferentes dos pontos-chave já mostrados.

Formato exato (sem campos extras):
{"deepDive":"...","extraPoints":["..."]}`;

export async function fetchConceptDeepDive(term, category, summary) {
  const parsed = await sendMessageJSON({
    system: CONCEPT_DEEPDIVE_SYSTEM_PROMPT,
    user: `Termo: ${term}\nCategoria: ${category || ""}\nJá explicado: ${summary || ""}`,
    maxTokens: 500,
  });
  if (!parsed.deepDive) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export const RELATED_NAMES_SYSTEM_PROMPT = `Você sugere nomes de conceitos ou tipos relacionados a um termo dado, num app estilo Pokédex de conhecimento.
Dado um termo e sua categoria, retorne SOMENTE nomes de 4 a 6 conceitos/tipos relacionados — sem explicá-los.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "related": 4 a 6 nomes curtos (1 a 4 palavras cada), em português, diferentes do termo original entre si.

Formato exato (sem campos extras):
{"related":["...","..."]}`;

export async function fetchRelatedConceptNames(term, category) {
  const parsed = await sendMessageJSON({
    system: RELATED_NAMES_SYSTEM_PROMPT,
    user: `Termo: ${term}\nCategoria: ${category || ""}`,
    maxTokens: 300,
  });
  if (!Array.isArray(parsed.related)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.related;
}

export const GOAL_SUGGESTIONS_SYSTEM_PROMPT = `Você sugere técnicas, exercícios ou ações concretas pra alguém progredir numa área específica da vida, dado um objetivo que a pessoa quer mais ou quer menos.
Dada a área, a direção (mais ou menos) e o alvo, sugira de 4 a 6 técnicas/ações práticas que ajudem a atingir isso.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome curto da técnica/ação (2 a 6 palavras), em português.
- "description": até 20 palavras, direto, explicando COMO essa técnica/ação ajuda a atingir o objetivo.
- Não repita nenhum item que a pessoa já pratique, se informado.
- Priorize técnicas específicas e acionáveis, nunca conselhos genéricos ("pratique mais", "tenha paciência").

Formato exato (sem campos extras):
{"suggestions":[{"name":"...","description":"..."}]}`;

/** Sugestões de técnicas/ações pra uma meta "+alvo" (mais) ou "-alvo" (menos) dentro de uma coleção/área. */
export async function fetchGoalSuggestions(areaName, direction, target, existingItems) {
  const existingNote = existingItems && existingItems.length ? `\nJá pratica: ${existingItems.join(", ")}.` : "";
  const parsed = await sendMessageJSON({
    system: GOAL_SUGGESTIONS_SYSTEM_PROMPT,
    user: `Área: ${areaName}\nObjetivo: quero ${direction} ${target}.${existingNote}`,
    maxTokens: 700,
  });
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.suggestions;
}

export const EFFECT_RATING_SYSTEM_PROMPT = `Você avalia o efeito de um item (suplemento, alimento, exercício ou prática) em critérios definidos pelo usuário, para um app pessoal de acompanhamento de efeitos.
Dado o nome do item, o domínio/contexto e uma lista de critérios, avalie o quanto esse item TIPICAMENTE afeta CADA critério.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "value": nota de -5 a +5 por critério — negativo significa que o item PIORA/REDUZ aquele critério, positivo que MELHORA/AUMENTA, 0 que não tem efeito relevante conhecido.
- Seja realista e criterioso, baseado em conhecimento geral — não infle notas, e use valores negativos sempre que fizer sentido (ex.: um estimulante pode reduzir um critério como "calma").
- "reason": justificativa de até 12 palavras por critério, explicando a nota.
- Retorne EXATAMENTE um item em "ratings" para cada critério informado, na mesma ordem.

Formato exato (sem campos extras):
{"ratings":[{"criterion":"...","value":0,"reason":"..."}]}`;

/** Avalia UM item novo (suplemento/alimento/exercício/prática) nos critérios atuais de um perfil de efeito. */
export async function fetchItemRatings(itemName, domainContext, criteriaLabels) {
  const parsed = await sendMessageJSON({
    system: EFFECT_RATING_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItem: ${itemName}\nCritérios (nesta ordem): ${criteriaLabels.join(", ")}`,
    maxTokens: 600,
  });
  if (!Array.isArray(parsed.ratings)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.ratings;
}

export const EFFECT_SUGGESTIONS_SYSTEM_PROMPT = `Você sugere adições ou substituições pra uma combinação de suplementos/alimentos ou exercícios/práticas, buscando um objetivo específico do usuário em critérios que ele mesmo definiu.
Dado o domínio, os itens atualmente ativos na combinação (com suas notas em cada critério) e o(s) critério(s)-alvo com a direção desejada, sugira de 3 a 6 itens novos (adições) ou trocas de um item já ativo.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "name": nome do item sugerido.
- "kind": "adicao" (some à combinação atual, sem tirar nada) ou "substituicao" (troca por um item específico já ativo).
- "replaces": nome EXATO de um item já ativo informado, obrigatório se "kind" for "substituicao"; string vazia "" se for "adicao".
- "estimatedRatings": nota de -5 a +5 pra CADA critério-alvo informado, na mesma ordem.
- "reason": justificativa de até 18 palavras, mencionando o principal trade-off ou efeito colateral, se houver.

Formato exato (sem campos extras):
{"suggestions":[{"name":"...","kind":"adicao","replaces":"","estimatedRatings":[0],"reason":"..."}]}`;

/**
 * Sugere adições/substituições pra um perfil de efeito, dado os itens ativos
 * e os critérios-alvo (cada um com direção "mais"/"menos").
 */
export async function fetchEffectSuggestions(domainContext, activeItems, targetCriteria) {
  const activeSummary = (activeItems || [])
    .map((it) => `${it.name} (${Object.entries(it.ratings || {}).map(([c, v]) => `${c}: ${v > 0 ? "+" : ""}${v}`).join(", ")})`)
    .join("; ");
  const targetSummary = targetCriteria.map((t) => `${t.direction} ${t.label}`).join(", ");
  const parsed = await sendMessageJSON({
    system: EFFECT_SUGGESTIONS_SYSTEM_PROMPT,
    user: `Domínio: ${domainContext}\nItens ativos: ${activeSummary || "nenhum"}\nObjetivo: quero ${targetSummary}\nCritérios-alvo (nesta ordem): ${targetCriteria
      .map((t) => t.label)
      .join(", ")}`,
    maxTokens: 900,
  });
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.suggestions;
}

export const WORD_SYSTEM_PROMPT = `Você é um dicionário morfológico para um app estilo Pokédex de palavras.
Dada uma palavra em QUALQUER idioma (português, inglês, mandarim, japonês, etc.), identifique o idioma dela e explique seu significado e formação.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "word": a palavra pesquisada, exatamente como foi digitada (correção ortográfica leve é aceitável).
- "language": nome do idioma da palavra, por extenso e em português (ex.: "Português", "Inglês", "Mandarim", "Japonês", "Espanhol", "Francês").
- "languageCode": código curto do idioma (ISO 639-1 quando existir: "pt", "en", "zh", "ja", "es", "fr", "de", "it", "ru", "ar", "ko" etc.).
- "meaning": o significado da palavra, SEMPRE em português, claro e direto (1-2 frases), mesmo que a palavra não seja portuguesa.
- "radical": o radical, raiz ou morfema base da palavra (no idioma original), com breve explicação de até 14 palavras.
- "semanticComponent": APENAS se o idioma for mandarim ("languageCode" "zh"): o componente semântico (radical gráfico que indica campo de significado) do caractere e o que ele indica. Nos demais idiomas, string vazia "".
- "phoneticComponent": APENAS se o idioma for mandarim ("languageCode" "zh"): o componente fonético do caractere e a pronúncia que ele sugere. Nos demais idiomas, string vazia "".

Formato exato (sem campos extras):
{"word":"...","language":"...","languageCode":"...","meaning":"...","radical":"...","semanticComponent":"","phoneticComponent":""}`;

export async function fetchWord(word, avoid, effort) {
  const parsed = await sendMessageJSON({
    system: WORD_SYSTEM_PROMPT,
    user: word + avoidNote(avoid),
    maxTokens: 700,
    effort,
  });
  if (!parsed.word || !parsed.language || !parsed.meaning) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export const WORD_ETYMOLOGY_SYSTEM_PROMPT = `Você é um especialista em etimologia, escrevendo para um app estilo Pokédex de palavras.
Dada uma palavra e o idioma dela, explique a ORIGEM ETIMOLÓGICA: de onde ela veio, por quais formas/idiomas passou, e COMO o significado mudou ao longo do tempo (se mudou) — incluindo, quando fizer sentido, comparações com outras línguas que preservam um sentido mais antigo (ex.: "sinistro" em português perdeu o significado de "esquerda" que o italiano ainda conserva).

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "originLanguage": o idioma de origem mais antigo identificável (ex.: "Latim", "Grego Antigo", "Proto-indo-europeu", "Chinês Clássico").
- "summary": 2-3 frases em português resumindo a trajetória da palavra e as mudanças de significado, se houver.
- "lineage": de 2 a 5 etapas, da mais antiga pra mais recente, cada uma com "language" (idioma/período), "form" (a forma da palavra nessa etapa) e "meaning" (o significado dela nessa etapa, em português).
- Seja específico: cite formas e significados reais, não genéricos.

Formato exato (sem campos extras):
{"originLanguage":"...","summary":"...","lineage":[{"language":"...","form":"...","meaning":"..."}]}`;

export async function fetchWordEtymology(word, language) {
  const parsed = await sendMessageJSON({
    system: WORD_ETYMOLOGY_SYSTEM_PROMPT,
    user: `Palavra: ${word}\nIdioma: ${language || ""}`,
    maxTokens: 700,
  });
  if (!parsed.summary || !Array.isArray(parsed.lineage)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}
