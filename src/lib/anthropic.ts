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
import { get, set, KEYS } from "./storage";
import { MODELS, modelFor, getSearchTiers } from "./models";
import { assertWithinBudget, trackUsage } from "./usage";
import { looksLikeApiKey, extractJson } from "./anthropicShared";

// Thinking adaptativo ligado em todas as chamadas. O MODELO de cada tarefa vem
// de lib/models.js (fixo para tarefas que não são busca, escolhido pelo usuário
// para os modos de busca); o esforço de saída das buscas é configurável, e o
// resto das chamadas (guias, aprofundamentos) fica fixo em "medium".
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

export { looksLikeApiKey };

/**
 * Quebra um data URL de imagem no par que a API espera. Só JPEG/PNG/WebP/GIF
 * são aceitos — o compressor de `lib/imageUtils.js` sempre entrega JPEG.
 */
function imageBlock(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de imagem não suportado.");
  return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
}

/**
 * Envia uma mensagem e devolve o texto concatenado dos blocos de resposta.
 *
 * `images` (data URLs) vira bloco de imagem ANTES do texto — é a ordem que a
 * API recomenda quando a pergunta é sobre a imagem.
 */
export async function sendMessage({
  system,
  user,
  images,
  maxTokens = 1000,
  effort = DEFAULT_EFFORT,
  model = MODELS.sonnet,
  signal,
}) {
  await assertWithinBudget();
  const [apiKey, proxyUrl] = await Promise.all([getApiKey(), getProxyUrl()]);
  if (!apiKey && !proxyUrl) throw new MissingApiKeyError();

  const content = (images || []).length
    ? [...images.map(imageBlock), { type: "text", text: user }]
    : user;

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
      signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        thinking: { type: "adaptive" },
        output_config: { effort },
        messages: [{ role: "user", content }],
      }),
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
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
  trackUsage(data.model || model, data.usage).catch(() => {});
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

/** Modelo escolhido pelo usuário para um MODO DE BUSCA (ver lib/models.js). */
export async function searchModelFor(mode) {
  return modelFor(mode, await getSearchTiers());
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
- Se critérios de comparação forem informados pelo usuário, leve-os em conta ao descrever cada item — a "description" de cada um deve tocar nesses critérios quando fizer sentido, sem inventar um campo novo.

Formato exato (sem campos extras):
{"subject":"...","subjectIntro":"...","items":[{"name":"...","category":"...","description":"..."}]}`;

/** Monta o texto de personalização a partir do que o usuário já marcou como pouco relevante. */
function avoidNote(avoid) {
  const clean = [...new Set((avoid || []).filter(Boolean))];
  if (!clean.length) return "";
  return `\n\n[Preferências do usuário: ele já marcou os itens a seguir como pouco relevantes em buscas anteriores — evite repeti-los ou sugerir variações muito parecidas: ${clean.join(", ")}.]`;
}

export async function fetchTechniques(subject, avoid, criteria, effort, signal?: AbortSignal) {
  const parsed = await sendMessageJSON({
    system: buildSearchSystemPrompt(criteria),
    user: subject + avoidNote(avoid),
    maxTokens: 1000,
    effort,
    model: await searchModelFor("technique"),
    signal,
  });
  if (!parsed.subject || !Array.isArray(parsed.statLabels) || !Array.isArray(parsed.techniques)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchDefinition(term, avoid?, effort?, signal?: AbortSignal) {
  const parsed = await sendMessageJSON({
    system: DEFINITION_SYSTEM_PROMPT,
    user: term + avoidNote(avoid),
    maxTokens: 900,
    effort,
    model: await searchModelFor("definition"),
    signal,
  });
  if (!parsed.term || !parsed.definition) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

/** Monta a nota de critérios de comparação, reaproveitada pelos modos "tec:"/"list:"/"cmp:". */
function criteriaNote(criteria) {
  const clean = [...new Set((criteria || []).map((c) => c.trim()).filter(Boolean))];
  if (!clean.length) return "";
  return `\n\n[Critérios de comparação pedidos pelo usuário: ${clean.join(", ")}.]`;
}

export async function fetchList(subject, avoid, effort, criteria, signal?: AbortSignal) {
  const parsed = await sendMessageJSON({
    system: LIST_SYSTEM_PROMPT,
    user: subject + avoidNote(avoid) + criteriaNote(criteria),
    maxTokens: 1000,
    effort,
    model: await searchModelFor("list"),
    signal,
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

export async function fetchCompare(names, avoid, criteria, effort, signal?: AbortSignal) {
  const parsed = await sendMessageJSON({
    system: buildCompareSystemPrompt(names, criteria),
    user: names.join(" vs ") + avoidNote(avoid),
    maxTokens: 1000,
    effort,
    model: await searchModelFor("compare"),
    signal,
  });
  if (!parsed.subject || !Array.isArray(parsed.statLabels) || !Array.isArray(parsed.techniques)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

export async function fetchDetail(subjectDisplay, technique) {
  const parsed = await sendMessageJSON({
    system: DETAIL_SYSTEM_PROMPT,
    user: `Assunto: ${subjectDisplay}\nTécnica: ${technique.name}\nTipo: ${technique.type}\nResumo: ${technique.description}`,
    maxTokens: 1200,
    model: modelFor("detail"),
  });
  if (!parsed.overview || !Array.isArray(parsed.steps)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

/**
 * Os três aspectos gerados sob demanda no card de técnica, além do guia
 * passo a passo (que já tinha seu próprio botão e continua com ele — ver
 * TechCard). Mesmo padrão dos aspectos de planta: cada um é uma chamada curta
 * e independente, paga só se o usuário tocar naquele botão.
 */
export const TECH_ASPECTS = [
  {
    id: "mistakes",
    label: "Erros comuns",
    prompt:
      "Os erros mais comuns de quem está aprendendo esta técnica, e como notar NA HORA se está sendo feita certo ou errado — além do que já foi dito na descrição.",
  },
  {
    id: "why",
    label: "Por que funciona",
    prompt:
      "O mecanismo por trás desta técnica: por que ela produz o efeito que produz, em termos concretos (fisiológicos, cognitivos ou comportamentais, o que se aplicar) — não apenas repetir o que ela faz.",
  },
  {
    id: "combos",
    label: "Combina com",
    prompt:
      "De 2 a 3 outras técnicas do MESMO assunto/domínio que combinam bem com esta, usadas em conjunto ou em sequência, e por que a combinação funciona melhor que cada uma sozinha.",
  },
];

export const TECH_ASPECT_SYSTEM_PROMPT = `Você escreve um trecho curto sobre UM aspecto específico de uma técnica, num app estilo Pokédex de técnicas.
Dado o assunto, o nome da técnica, o tipo e a descrição já mostrada, escreva SÓ sobre o aspecto pedido.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "text": de 3 a 5 linhas de texto corrido em português (aproximadamente 45 a 80 palavras), específico e acionável — nada de conselho genérico.
- Não repita a descrição já mostrada nem escreva sobre os outros aspectos.

Formato exato (sem campos extras):
{"text":"..."}`;

export async function fetchTechAspect(subjectDisplay, technique, aspectId) {
  const aspect = TECH_ASPECTS.find((a) => a.id === aspectId);
  if (!aspect) throw new Error("Aspecto desconhecido.");
  const parsed = await sendMessageJSON({
    system: TECH_ASPECT_SYSTEM_PROMPT,
    user: `Assunto: ${subjectDisplay}\nTécnica: ${technique.name}\nTipo: ${technique.type || ""}\nDescrição: ${technique.description || ""}\nAspecto pedido: ${aspect.label} — ${aspect.prompt}`,
    maxTokens: 500,
    model: modelFor("techAspect"),
  });
  if (!parsed.text) throw new Error("Formato inesperado na resposta");
  return parsed.text;
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
    model: modelFor("stepDeepDive"),
  });
  if (!Array.isArray(parsed.substeps)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed.substeps;
}

/**
 * Preenche os campos que a conversão de um card entre tipos não consegue
 * deduzir sozinha (stats de técnica, pontos-chave de conceito). O prompt muda
 * conforme o tipo de DESTINO — o resto do card já foi convertido localmente.
 */
const ENRICH_SYSTEM_PROMPT = {
  technique: `Você completa a ficha de uma TÉCNICA num app estilo Pokédex de conhecimento.
O usuário converteu um card que antes era um conceito ou um tipo em uma técnica, e agora faltam os campos próprios de técnica.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "type": uma palavra em português classificando a técnica (ex.: "memoria", "foco", "calma").
- "bestFor": em que situação essa técnica é a melhor escolha (até 12 palavras, em português).
- "statLabels": exatamente 4 critérios de avaliação em português, curtos (1 a 3 palavras), adequados a esta técnica.
- "stats": exatamente 4 inteiros de 1 a 5, na MESMA ordem de "statLabels".
- Se o item não for praticável como técnica, ainda assim preencha da forma mais honesta possível, com notas baixas.

Formato exato (sem campos extras):
{"type":"...","bestFor":"...","statLabels":["...","...","...","..."],"stats":[3,4,2,5]}`,

  definition: `Você completa a ficha de um CONCEITO num app estilo Pokédex de conhecimento.
O usuário converteu um card que antes era uma técnica ou um tipo em um conceito, e agora faltam os campos próprios de verbete.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "definition": 1 a 3 frases definindo o termo, em português, sem repetir literalmente o texto já existente.
- "keyPoints": 3 a 5 pontos-chave (até 14 palavras cada), em português.
- "example": um exemplo concreto e curto, em português.
- "relatedTerms": 2 a 4 termos relacionados, em português.
- "category": uma palavra ou expressão curta classificando o conceito.

Formato exato (sem campos extras):
{"definition":"...","keyPoints":["..."],"example":"...","relatedTerms":["..."],"category":"..."}`,

  list: `Você completa a ficha de um TIPO/ITEM de enumeração num app estilo Pokédex de conhecimento.
O usuário converteu um card que antes era uma técnica ou um conceito em um tipo, e agora falta a descrição própria.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "description": 1 a 2 frases descrevendo o item, em português.
- "category": uma palavra ou expressão curta classificando o item.

Formato exato (sem campos extras):
{"description":"...","category":"..."}`,
};

export async function fetchItemEnrichment(targetKind, subjectDisplay, item) {
  const system = ENRICH_SYSTEM_PROMPT[targetKind];
  if (!system) throw new Error("Tipo de card desconhecido para completar.");
  const label = item.term || item.name || "";
  const body = item.description || item.definition || "";
  const parsed = await sendMessageJSON({
    system,
    user: `Assunto: ${subjectDisplay}\nItem: ${label}\nCategoria: ${item.category || ""}\nJá temos: ${body}`,
    maxTokens: 600,
    model: modelFor("enrichment"),
  });
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Formato inesperado na resposta");
  }
  if (targetKind === "technique" && !(Array.isArray(parsed.stats) && Array.isArray(parsed.statLabels))) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
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
    model: modelFor("conceptDeepDive"),
  });
  if (!parsed.deepDive) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

/**
 * Os quatro aspectos gerados sob demanda no card de conceito (modo def:),
 * substituindo o antigo botão único de "aprofundar" (que ainda existe para
 * ListItemCard, via fetchConceptDeepDive acima — tipos não entraram nesta
 * mudança). Mesmo padrão dos aspectos de planta/técnica.
 */
export const CONCEPT_ASPECTS = [
  {
    id: "deepen",
    label: "Aprofundar",
    prompt:
      "Um aprofundamento do conceito além da definição já mostrada — mecanismos, nuances ou contexto que a explicação resumida não cobriu.",
  },
  {
    id: "confusion",
    label: "Erros de interpretação",
    prompt:
      "O erro de interpretação mais comum sobre este conceito, e/ou com qual outro termo ele costuma ser confundido — e o que de fato os distingue.",
  },
  {
    id: "examples",
    label: "Onde se manifesta",
    prompt:
      "De 1 a 2 situações concretas do dia a dia (ou de um campo específico) em que este conceito se manifesta claramente, explicando COMO ele aparece em cada uma.",
  },
  {
    id: "related",
    label: "Conceitos relacionados",
    prompt:
      "De 2 a 3 conceitos similares ou complementares a este, e como cada um se relaciona com ele — no que se parecem ou como se complementam.",
  },
];

export const CONCEPT_ASPECT_SYSTEM_PROMPT = `Você escreve um trecho curto sobre UM aspecto específico de um conceito, num app estilo Pokédex de conhecimento.
Dado o termo, a categoria e a definição já mostrada, escreva SÓ sobre o aspecto pedido.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "text": de 3 a 5 linhas de texto corrido em português (aproximadamente 45 a 80 palavras), específico — sem repetir a definição já mostrada nem escrever sobre os outros aspectos.

Formato exato (sem campos extras):
{"text":"..."}`;

export async function fetchConceptAspect(definition, aspectId) {
  const aspect = CONCEPT_ASPECTS.find((a) => a.id === aspectId);
  if (!aspect) throw new Error("Aspecto desconhecido.");
  const parsed = await sendMessageJSON({
    system: CONCEPT_ASPECT_SYSTEM_PROMPT,
    user: `Termo: ${definition.term}\nCategoria: ${definition.category || ""}\nDefinição: ${definition.definition || ""}\nAspecto pedido: ${aspect.label} — ${aspect.prompt}`,
    maxTokens: 500,
    model: modelFor("conceptAspect"),
  });
  if (!parsed.text) throw new Error("Formato inesperado na resposta");
  return parsed.text;
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
    model: modelFor("relatedNames"),
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
    model: modelFor("goalSuggestions"),
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
- "word": a palavra pesquisada, exatamente como foi digitada (correção ortográfica leve é aceitável). Se for mandarim, use os caracteres em hanzi (nunca pinyin no lugar do hanzi).
- "language": nome do idioma da palavra, por extenso e em português (ex.: "Português", "Inglês", "Mandarim", "Japonês", "Espanhol", "Francês").
- "languageCode": código curto do idioma (ISO 639-1 quando existir: "pt", "en", "zh", "ja", "es", "fr", "de", "it", "ru", "ar", "ko" etc.).
- "meaning": o significado da palavra, SEMPRE em português, claro e direto (1-2 frases), mesmo que a palavra não seja portuguesa.
- "pinyin": OBRIGATÓRIO se o idioma for mandarim ("languageCode" "zh") — a romanização pinyin completa da palavra, com marcação de tom (ex.: "míngbái"). Nos demais idiomas, string vazia "".
- "radical": APENAS se o idioma NÃO for mandarim: o radical, raiz ou morfema base da palavra, incluindo OBRIGATORIAMENTE a língua de origem, a forma original e o significado original dessa forma, neste formato: "<radical> — do <idioma de origem> <forma original>, que significa \"<significado original>\"" (ex.: "gat- — do latim cattus, que significa \"gato\""). Mandarim NUNCA usa este campo (string vazia "").
- "characters": OBRIGATÓRIO se o idioma for mandarim, mesmo com um hanzi só — um array com UMA entrada por hanzi, na mesma ordem em que aparecem na palavra, cada uma com "hanzi" (o caractere), "pinyin" (pinyin desse caractere isolado, com tom) e "meaning" (significado desse caractere isolado, em português). Nada além desses três campos. Nos demais idiomas, array vazio [].

Formato exato (sem campos extras):
{"word":"...","language":"...","languageCode":"...","meaning":"...","pinyin":"","radical":"","characters":[]}`;

/**
 * Verbete de uma palavra. Fixo em Haiku: depois que a identificação dos
 * componentes semântico/fonético dos hanzi saiu do app, o que sobrou —
 * idioma, significado, pinyin, radical e o sentido de cada caractere — é
 * consulta de dicionário, não análise, e não justifica o modelo maior. Por
 * isso também ignora o "esforço de busca" configurado.
 */
export async function fetchWord(word, avoid, signal?: AbortSignal) {
  const parsed = await sendMessageJSON({
    system: WORD_SYSTEM_PROMPT,
    user: word + avoidNote(avoid),
    maxTokens: 900,
    model: modelFor("word"),
    signal,
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
    model: modelFor("wordEtymology"),
  });
  if (!parsed.summary || !Array.isArray(parsed.lineage)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed;
}

/* Plantas ----------------------------------------------------------------- */

const PLANT_FIELDS_RULE = `- "scientificName": o nome científico (binômio latino), com a inicial do gênero maiúscula (ex.: "Rosmarinus officinalis"). Se houver dúvida entre espécies próximas, escolha a mais provável e diga isso em "note".
- "commonNames": de 2 a 5 nomes populares mais usados em português do Brasil, do mais comum para o menos comum. Se a planta for conhecida por um nome só, retorne só ele.
- "family": a família botânica (ex.: "Lamiaceae").
- "summary": de 2 a 3 frases em português descrevendo a planta — o que ela é, onde costuma ser encontrada e para que é mais conhecida. Sem repetir os nomes populares em lista.
- "note": string vazia "" quando a identificação for direta; quando houver incerteza ou confusão comum com outra planta, 1 frase dizendo qual e como diferenciar.`;

export const PLANT_NAME_SYSTEM_PROMPT = `Você é um botânico escrevendo fichas de plantas para um app estilo Pokédex.
Dado o nome (popular ou científico) de uma planta em português, identifique-a e preencha a ficha.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
${PLANT_FIELDS_RULE}

Formato exato (sem campos extras):
{"scientificName":"...","commonNames":["..."],"family":"...","summary":"...","note":""}`;

export const PLANT_PHOTO_SYSTEM_PROMPT = `Você é um botânico identificando plantas por foto para um app estilo Pokédex.
Dada uma ou mais fotos de uma planta, identifique a espécie e preencha a ficha.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
${PLANT_FIELDS_RULE}
- Baseie-se SÓ no que é visível na foto (folha, caule, flor, fruto, porte, nervuras, disposição). Não invente detalhes que a imagem não mostra.
- Se a foto não permitir chegar à espécie, vá até onde der (gênero ou família) e escreva isso em "note", explicando que parte da planta faltou fotografar para fechar a identificação.
- Se a imagem não tiver planta nenhuma, retorne "scientificName" como string vazia "" e explique em "note".

Formato exato (sem campos extras):
{"scientificName":"...","commonNames":["..."],"family":"...","summary":"...","note":""}`;

function normalizePlant(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("Formato inesperado na resposta");
  // `note` da API vira `idNote`: o campo `note` de um item salvo é a anotação
  // pessoal do usuário, e as duas coisas não podem ocupar o mesmo nome.
  return {
    scientificName: parsed.scientificName || "",
    commonNames: Array.isArray(parsed.commonNames) ? parsed.commonNames.filter(Boolean) : [],
    family: parsed.family || "",
    summary: parsed.summary || "",
    idNote: parsed.note || "",
  };
}

export async function fetchPlantByName(name, avoid, effort, signal?: AbortSignal) {
  const parsed = await sendMessageJSON({
    system: PLANT_NAME_SYSTEM_PROMPT,
    user: name + avoidNote(avoid),
    maxTokens: 700,
    effort,
    model: await searchModelFor("plant"),
    signal,
  });
  const plant = normalizePlant(parsed);
  if (!plant.scientificName && !plant.commonNames.length) {
    throw new Error("Não consegui identificar essa planta. Tente outro nome.");
  }
  return plant;
}

/**
 * Identificação por foto. As imagens chegam como data URLs já comprimidos
 * (lib/imageUtils.js) e são devolvidas junto com a ficha, porque é a foto do
 * usuário que vai no topo do card — não uma imagem buscada em lugar nenhum.
 */
export async function fetchPlantFromPhoto(images, effort) {
  if (!images || !images.length) throw new Error("Nenhuma foto para identificar.");
  const parsed = await sendMessageJSON({
    system: PLANT_PHOTO_SYSTEM_PROMPT,
    user: "Identifique esta planta.",
    images,
    maxTokens: 700,
    effort,
    model: await searchModelFor("plant"),
  });
  const plant = normalizePlant(parsed);
  if (!plant.scientificName && !plant.commonNames.length) {
    throw new Error(plant.idNote || "Não consegui identificar a planta desta foto.");
  }
  return { ...plant, images };
}

export const PLANT_DIAGNOSIS_SYSTEM_PROMPT = `Você é um botânico/fitopatologista diagnosticando problemas de plantas por foto, para um app estilo Pokédex.
Dada uma ou mais fotos de uma planta com aparência problemática (manchas, murcha, amarelamento, pragas visíveis, etc.), identifique o(s) problema(s) mais prováveis.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- Baseie-se SÓ no que é visível na foto. Não invente sintomas que a imagem não mostra.
- "diseasesFound": true se algum problema visível foi identificado, false se a planta parece saudável ou a foto não permite avaliar.
- "issues": lista de 1 a 3 problemas prováveis, do mais provável ao menos provável, cada um com:
  - "name": nome do problema (ex.: "Oídio", "Ferrugem", "Cochonilha", "Excesso de rega").
  - "overview": 2-3 frases descrevendo o problema e como ele aparece na foto especificamente.
  - "causes": lista de 2 a 4 causas prováveis (ex.: "Excesso de água", "Luz insuficiente", "Infestação de fungo", "Baixa umidade").
  - "treatment": 2-4 frases de tratamento prático e específico (não genérico).
- Se a planta parecer saudável, "issues" deve ser uma lista vazia e "note" deve dizer isso.
- Se a foto não permitir avaliar (ruim, planta não visível), "diseasesFound" false e explique em "note".

Formato exato (sem campos extras):
{"diseasesFound":true,"issues":[{"name":"...","overview":"...","causes":["..."],"treatment":"..."}],"note":""}`;

/**
 * Diagnóstico de doença/praga a partir de foto — card de resultado, sem
 * anotação de região tocável na imagem (isso é visão computacional local, não
 * o que um LLM de linguagem faz bem); o card mostra causas prováveis e
 * tratamento, não um overlay apontando pra pixels específicos da foto.
 */
export async function fetchPlantDiagnosis(images: string[], effort?: string) {
  if (!images || !images.length) throw new Error("Nenhuma foto para diagnosticar.");
  const parsed = await sendMessageJSON({
    system: PLANT_DIAGNOSIS_SYSTEM_PROMPT,
    user: "Diagnostique os problemas desta planta.",
    images,
    maxTokens: 800,
    effort,
    model: modelFor("plantDiagnosis"),
  });
  if (typeof parsed?.diseasesFound !== "boolean" || !Array.isArray(parsed.issues)) {
    throw new Error("Formato inesperado na resposta");
  }
  return parsed as { diseasesFound: boolean; issues: { name: string; overview: string; causes: string[]; treatment: string }[]; note: string };
}

/**
 * Os aspectos que os botões-ícone do card de planta geram sob demanda.
 * Cada um é uma chamada curta e independente — o card nasce só com o resumo, e
 * o usuário paga por aspecto, quando quiser aquele aspecto.
 */
export const PLANT_ASPECTS = [
  {
    id: "origin",
    label: "Origem e história",
    prompt:
      'De onde a planta é originária (região/bioma) e desde quando há registro de uso humano dela — épocas, povos e para quê era usada no começo. Se a data for incerta, diga "há registros desde..." em vez de inventar precisão.',
  },
  {
    id: "identification",
    label: "Como identificar",
    prompt:
      "Características concretas que permitem reconhecer e distinguir esta planta no campo: forma, tamanho e borda das folhas, disposição no caule, cor e formato da flor, cheiro ao amassar a folha, textura, porte. Cite ao menos uma planta com que ela costuma ser confundida e o traço que separa as duas.",
  },
  {
    id: "cultivation",
    label: "Solo, clima e ciclo",
    prompt:
      "Tipo de solo (textura, drenagem, pH), clima e luminosidade que a planta pede, e o calendário dela no Brasil: época de semeadura/plantio, de floração e de frutificação. Se o ciclo variar muito por região, diga isso e dê a referência do Sudeste.",
  },
  {
    id: "medicinal",
    label: "Usos medicinais",
    prompt:
      "Usos medicinais atribuídos à planta, qual parte é usada e de que forma (chá, tintura, tópico). Separe o que tem respaldo em estudos do que é uso tradicional sem comprovação, e cite contraindicações ou toxicidade conhecidas.",
  },
  {
    id: "petSafety",
    label: "Segurança para pets",
    prompt:
      "Esta planta é tóxica para cães e/ou gatos? Diga qual parte é a mais tóxica (folha, fruto, seiva, bulbo...), o(s) princípio(s) ativo(s) responsável(is) quando conhecido(s), e os sintomas esperados de ingestão/contato (do mais leve ao mais grave). Se não houver toxicidade conhecida para nenhum dos dois, diga isso claramente em vez de inventar risco.",
  },
];

export const PLANT_ASPECT_SYSTEM_PROMPT = `Você é um botânico escrevendo um trecho curto sobre UM aspecto específico de uma planta, num app estilo Pokédex.
Dado o nome científico da planta, seus nomes populares e o aspecto pedido, escreva SÓ sobre esse aspecto.

Regras obrigatórias:
- Responda APENAS com um objeto JSON válido. Sem markdown, sem crases, sem texto antes ou depois.
- "text": de 3 a 5 linhas de texto corrido em português (aproximadamente 45 a 80 palavras), específico e verificável — nomes, números, épocas, medidas. Nada de conselho genérico.
- Não repita o resumo geral da planta nem escreva sobre outros aspectos.
- Se algum ponto pedido não se aplicar a esta planta, diga isso em uma oração curta em vez de preencher com genérico.

Formato exato (sem campos extras):
{"text":"..."}`;

export async function fetchPlantAspect(plant, aspectId) {
  const aspect = PLANT_ASPECTS.find((a) => a.id === aspectId);
  if (!aspect) throw new Error("Aspecto desconhecido.");
  const parsed = await sendMessageJSON({
    system: PLANT_ASPECT_SYSTEM_PROMPT,
    user: `Planta: ${plant.scientificName || ""}\nNomes populares: ${(plant.commonNames || []).join(", ")}\nFamília: ${plant.family || ""}\nAspecto pedido: ${aspect.label} — ${aspect.prompt}`,
    maxTokens: 500,
    model: modelFor("plantAspect"),
  });
  if (!parsed.text) throw new Error("Formato inesperado na resposta");
  return parsed.text;
}
