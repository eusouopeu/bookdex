/**
 * Conversão de um card entre os três tipos (técnica ↔ conceito ↔ tipo).
 *
 * Como `kind` é do item (schema v3), converter é trocar um campo e remapear
 * o conteúdo: o item continua no mesmo assunto, com o mesmo `id`, `savedAt`,
 * tags, nota e imagens — o que mantém válidas as refs de coleção que apontam
 * pra ele e permite desfazer pelo toast, sem rede e sem custo de API.
 *
 * O que não dá pra deduzir localmente (stats de uma técnica, pontos-chave de
 * um conceito) fica em branco e é preenchido depois, sob demanda, por
 * `applyEnrichment` com o que a API devolveu.
 */
import { itemLabel } from "./savedModel";

/** Campos exclusivos de cada tipo, removidos quando o item deixa de sê-lo. */
const KIND_ONLY_FIELDS = {
  technique: ["type", "bestFor", "stats", "statLabels"],
  definition: ["term", "definition", "keyPoints", "example", "relatedTerms"],
  list: [],
};

function stripped(item) {
  const clean = { ...item };
  for (const fields of Object.values(KIND_ONLY_FIELDS)) {
    for (const field of fields) delete clean[field];
  }
  delete clean.name;
  delete clean.description;
  // Os ids de aspecto (mistakes/why/combos, deepen/confusion/..., etc.) são
  // próprios de cada kind — os de um card de técnica não significam nada num
  // conceito, então não faz sentido carregá-los na conversão.
  delete clean.aspects;
  return clean;
}

/** Texto corrido do item, seja qual for o tipo de origem. */
export function itemBodyText(item) {
  return item?.description || item?.definition || "";
}

/**
 * Converte `item` para `targetKind`, preservando identidade e anotações.
 * Retorna o próprio item quando o tipo de destino já é o atual.
 */
export function convertItem(item, targetKind) {
  const currentKind = item?.kind || "technique";
  if (!item || currentKind === targetKind) return item;

  const label = itemLabel(item);
  const body = itemBodyText(item);
  const base = { ...stripped(item), kind: targetKind, convertedFrom: currentKind, convertedAt: Date.now() };

  if (targetKind === "definition") {
    return { ...base, term: label, definition: body, keyPoints: [], example: "", relatedTerms: [] };
  }
  if (targetKind === "list") {
    return { ...base, name: label, description: body };
  }
  return {
    ...base,
    name: label,
    description: body,
    type: item.category || item.type || "geral",
    bestFor: "",
    stats: [],
    statLabels: [],
  };
}

/**
 * Campos que a conversão não conseguiu preencher sozinha e que só a API sabe
 * produzir. Lista vazia = o card já está completo.
 */
export function missingFields(item) {
  if (!item) return [];
  const kind = item.kind || "technique";
  if (kind === "technique") {
    const missing = [];
    if (!(item.stats || []).length || !(item.statLabels || []).length) missing.push("stats");
    if (!item.bestFor) missing.push("bestFor");
    return missing;
  }
  if (kind === "definition") {
    const missing = [];
    if (!(item.keyPoints || []).length) missing.push("keyPoints");
    if (!item.example) missing.push("example");
    return missing;
  }
  return item.description ? [] : ["description"];
}

/** Só oferece o "completar com IA" em card convertido e ainda incompleto. */
export function needsEnrichment(item) {
  return !!item?.convertedFrom && missingFields(item).length > 0;
}

/** Aplica sobre o item o que a API devolveu, sem sobrescrever o que o usuário já tem. */
export function applyEnrichment(item, data) {
  if (!item || !data) return item;
  const kind = item.kind || "technique";
  const next = { ...item };

  if (kind === "technique") {
    if (Array.isArray(data.statLabels) && Array.isArray(data.stats)) {
      next.statLabels = data.statLabels;
      next.stats = data.stats;
    }
    if (!next.bestFor && data.bestFor) next.bestFor = data.bestFor;
    if (data.type) next.type = data.type;
    if (!next.description && data.description) next.description = data.description;
  } else if (kind === "definition") {
    if (!(next.keyPoints || []).length && Array.isArray(data.keyPoints)) next.keyPoints = data.keyPoints;
    if (!next.example && data.example) next.example = data.example;
    if (!(next.relatedTerms || []).length && Array.isArray(data.relatedTerms)) next.relatedTerms = data.relatedTerms;
    if (!next.definition && data.definition) next.definition = data.definition;
    if (!next.category && data.category) next.category = data.category;
  } else {
    if (!next.description && data.description) next.description = data.description;
    if (!next.category && data.category) next.category = data.category;
  }

  if (missingFields(next).length === 0) delete next.convertedFrom;
  return next;
}
