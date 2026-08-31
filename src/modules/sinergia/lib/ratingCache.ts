/**
 * Cache global de avaliações (item × critério), compartilhado por TODOS os
 * perfis.
 *
 * Avaliar "Cafeína" em "Sono" custava uma chamada por perfil, toda vez — o
 * cache que existia (`explainCache`) era local ao item. Aqui a chave é só o
 * par de nomes normalizados, então re-adicionar um item, avaliá-lo noutro
 * perfil ou preencher um critério novo reaproveita o que já foi pago.
 *
 * O que fica guardado é a estimativa da IA (valor, justificativa,
 * probabilidade, confiança) — nunca o valor pessoal editado, que é do item e
 * não do par de nomes.
 */
import { getJSON, setJSON } from "./storage";
import { slug } from "../theme";

const KEY = "rating-cache";
const MAX_ENTRIES = 2000;

let memo: Record<string, any> | null = null;

function cacheKey(itemName: string, criterionLabel: string) {
  return `${slug(itemName)}|${slug(criterionLabel)}`;
}

async function load() {
  if (!memo) memo = await getJSON(KEY, {});
  return memo as Record<string, any>;
}

async function persist() {
  const entries = Object.entries(memo || {});
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    memo = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  }
  await setJSON(KEY, memo);
}

/** Estimativa guardada pra um par (item, critério), ou null. */
export async function getCachedRating(itemName: string, criterionLabel: string) {
  const cache = await load();
  return cache[cacheKey(itemName, criterionLabel)] || null;
}

export async function putCachedRating(itemName: string, criterionLabel: string, entry: any) {
  const cache = await load();
  cache[cacheKey(itemName, criterionLabel)] = {
    value: entry.value,
    reason: entry.reason || "",
    probability: entry.probability,
    confidence: entry.confidence,
    at: Date.now(),
  };
  await persist();
}

export async function ratingCacheSize() {
  return Object.keys(await load()).length;
}

export async function clearRatingCache() {
  memo = {};
  await setJSON(KEY, memo);
}
