/**
 * Quais modelos o app usa, quanto cada um custa e quem escolhe qual.
 *
 * Antes havia um `MODEL` fixo (Sonnet) para tudo. Agora cada tarefa aponta
 * para um "tier" (`sonnet` ou `haiku`):
 *
 *   - tarefas de raciocínio livre (guias, aprofundamentos, comparações) ficam
 *     em Sonnet, fixas no código;
 *   - tarefas de recuperação estruturada (palavras, nomes relacionados,
 *     completar campos de um card convertido) ficam em Haiku, fixas — são
 *     preenchimento de formulário, não análise;
 *   - os modos de BUSCA são escolhidos pelo usuário em Configurações, porque
 *     é aí que o custo se concentra e a preferência varia por assunto.
 */
import { getJSON, setJSON, KEYS } from "./storage";

export const MODELS = {
  sonnet: "claude-sonnet-5",
  haiku: "claude-haiku-4-5-20251001",
};

export const TIER_LABELS = {
  sonnet: "Sonnet",
  haiku: "Haiku",
};

/** Preço de lista em USD por milhão de tokens. Usado só para estimar custo. */
export const PRICING = {
  [MODELS.sonnet]: { input: 3, output: 15 },
  [MODELS.haiku]: { input: 1, output: 5 },
};

/**
 * Tier fixo por tarefa que não é busca. Nada aqui é configurável: ou a tarefa
 * exige raciocínio (Sonnet) ou é consulta estruturada (Haiku).
 */
const FIXED_TIER = {
  detail: "sonnet", // guia passo a passo de uma técnica
  stepDeepDive: "sonnet",
  conceptDeepDive: "sonnet",
  plantAspect: "sonnet", // texto de 3-5 linhas sobre um aspecto da planta/técnica/conceito
  techAspect: "sonnet",
  conceptAspect: "sonnet",
  goalSuggestions: "sonnet",
  word: "haiku", // verbete de dicionário: significado, pinyin, radical
  wordEtymology: "haiku",
  relatedNames: "haiku",
  enrichment: "haiku",
};

/** Modos de busca cujo modelo o usuário escolhe em Configurações. */
export const SEARCH_MODE_TIERS = [
  { mode: "technique", label: "Técnicas", default: "sonnet" },
  { mode: "definition", label: "Conceito", default: "sonnet" },
  { mode: "list", label: "Tipos", default: "haiku" },
  { mode: "compare", label: "Comparar", default: "sonnet" },
  { mode: "plant", label: "Plantas", default: "sonnet" },
];

export function defaultSearchTiers() {
  return Object.fromEntries(SEARCH_MODE_TIERS.map((m) => [m.mode, m.default]));
}

function sanitizeTiers(raw) {
  const base = defaultSearchTiers();
  if (!raw || typeof raw !== "object") return base;
  for (const { mode } of SEARCH_MODE_TIERS) {
    if (raw[mode] === "sonnet" || raw[mode] === "haiku") base[mode] = raw[mode];
  }
  return base;
}

export async function getSearchTiers() {
  return sanitizeTiers(await getJSON(KEYS.searchModels, null));
}

export async function setSearchTiers(tiers) {
  await setJSON(KEYS.searchModels, sanitizeTiers(tiers));
}

/**
 * Modelo a usar numa tarefa. `searchTiers` só é consultado para os modos de
 * busca; sem ele (ou sem entrada para o modo), cai no padrão do modo.
 */
export function modelFor(task, searchTiers) {
  const searchMode = SEARCH_MODE_TIERS.find((m) => m.mode === task);
  if (searchMode) {
    const tier = (searchTiers || {})[task] || searchMode.default;
    return MODELS[tier] || MODELS.sonnet;
  }
  return MODELS[FIXED_TIER[task] || "sonnet"];
}

/** Custo em USD de um par (entrada, saída) de tokens num modelo. */
export function costOf(model, inputTokens, outputTokens) {
  const price = PRICING[model] || PRICING[MODELS.sonnet];
  return (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
}

/**
 * Tokens típicos (entrada, saída) de cada tarefa, medidos por amostragem —
 * não é exato (a resposta real varia), só o suficiente pra mostrar uma
 * estimativa de custo ANTES de tocar no botão que gasta a chamada.
 */
const ESTIMATED_TOKENS = {
  detail: { input: 400, output: 1200 },
  stepDeepDive: { input: 350, output: 400 },
  conceptDeepDive: { input: 300, output: 350 },
  plantAspect: { input: 300, output: 220 },
  techAspect: { input: 300, output: 220 },
  conceptAspect: { input: 300, output: 220 },
  goalSuggestions: { input: 250, output: 400 },
  enrichment: { input: 300, output: 300 },
  technique: { input: 250, output: 1000 },
  definition: { input: 200, output: 500 },
  list: { input: 200, output: 700 },
  compare: { input: 300, output: 1000 },
  plant: { input: 200, output: 400 },
};

/** Estimativa de custo (USD) de uma tarefa, com o tier atual de busca (quando se aplica). */
export function estimateCost(task, searchTiers) {
  const tokens = ESTIMATED_TOKENS[task];
  if (!tokens) return 0;
  return costOf(modelFor(task, searchTiers), tokens.input, tokens.output);
}

/** "US$ 0,004" — formato curto pra caber num tooltip/rótulo de botão. */
export function formatCost(usd) {
  if (usd < 0.01) return `US$ ${usd.toFixed(3)}`;
  return `US$ ${usd.toFixed(2)}`;
}
