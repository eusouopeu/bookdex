/**
 * Cache dos RESULTADOS de busca.
 *
 * Guias já tinham cache (`detailCache`); buscas não — repetir o mesmo termo no
 * mesmo modo refazia a chamada e pagava os tokens de novo. O histórico só
 * redisparava a busca, o que tornava o atalho a coisa mais cara do app.
 *
 * A chave inclui tudo que muda a resposta: modo, termo, critérios, esforço e
 * modelo. Trocar qualquer um deles é outra busca, não um cache velho.
 *
 * Entradas vencem em TTL_MS. O usuário sempre pode forçar rede pelo botão
 * "refazer busca", que passa por cima do cache e regrava a entrada.
 */
import { getJSON, setJSON, KEYS } from "./storage";
import { slug } from "../theme";

export const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const MAX_ENTRIES = 60;

export function cacheKey({ mode, term, criteria, effort, model }) {
  const crit = [...new Set((criteria || []).map((c) => c.trim()).filter(Boolean))]
    .map((c) => slug(c))
    .sort()
    .join(",");
  return [mode, slug(term), crit, effort || "", model || ""].join("|");
}

/** Entrada ainda válida, ou null. Função pura — o `store` vem de fora. */
export function readCache(store, key, now = Date.now()) {
  const entry = (store || {})[key];
  if (!entry) return null;
  if (now - (entry.at || 0) > TTL_MS) return null;
  return entry;
}

/**
 * Grava a entrada e poda as mais antigas acima de MAX_ENTRIES — o storage do
 * aparelho é pequeno e um resultado de busca não é dado que se perca.
 */
export function writeCache(store, key, data, now = Date.now()) {
  const next = { ...(store || {}), [key]: { at: now, data } };
  const keys = Object.keys(next);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (next[a].at || 0) - (next[b].at || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete next[k]);
  }
  return next;
}

export function dropCache(store, key) {
  const next = { ...(store || {}) };
  delete next[key];
  return next;
}

/* ------------------------------------------------------------- persistência */

export async function loadSearchCache() {
  return await getJSON(KEYS.searchCache, {});
}

export async function saveSearchCache(store) {
  await setJSON(KEYS.searchCache, store);
}

export async function clearSearchCache() {
  await setJSON(KEYS.searchCache, {});
}

/** Quantas entradas ainda válidas existem — mostrado em Configurações. */
export function countValid(store, now = Date.now()) {
  return Object.values(store || {}).filter((e) => now - (e.at || 0) <= TTL_MS).length;
}
