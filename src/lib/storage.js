/**
 * Camada de persistência com as MESMAS assinaturas do `window.storage` do
 * artifacts runtime do claude.ai, para minimizar mudanças no resto do código.
 *
 *   get(key)    -> { value: string } | null
 *   set(key, value)
 *   delete(key)
 *   list()      -> [{ key }]
 *
 * Implementação: @capacitor/preferences (nativo no APK, IndexedDB/localStorage
 * no navegador). Se o plugin não estiver disponível por qualquer motivo,
 * cai para localStorage puro.
 */
import { Preferences } from "@capacitor/preferences";

const PREFIX = "tecnicadex:";
const INDEX_KEY = PREFIX + "__keys__";

let backend = null;

async function pickBackend() {
  if (backend) return backend;
  try {
    await Preferences.get({ key: INDEX_KEY });
    backend = "preferences";
  } catch (e) {
    console.warn("[storage] Preferences indisponível, usando localStorage", e);
    backend = "local";
  }
  return backend;
}

async function rawGet(key) {
  if ((await pickBackend()) === "preferences") {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }
  return localStorage.getItem(key);
}

async function rawSet(key, value) {
  if ((await pickBackend()) === "preferences") {
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

async function rawRemove(key) {
  if ((await pickBackend()) === "preferences") {
    await Preferences.remove({ key });
    return;
  }
  localStorage.removeItem(key);
}

async function readIndex() {
  const raw = await rawGet(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(keys) {
  await rawSet(INDEX_KEY, JSON.stringify(keys));
}

export async function get(key) {
  const value = await rawGet(PREFIX + key);
  if (value === null || value === undefined) return null;
  return { key, value };
}

export async function set(key, value) {
  await rawSet(PREFIX + key, value);
  const keys = await readIndex();
  if (!keys.includes(key)) {
    keys.push(key);
    await writeIndex(keys);
  }
}

async function remove(key) {
  await rawRemove(PREFIX + key);
  const keys = await readIndex();
  const next = keys.filter((k) => k !== key);
  if (next.length !== keys.length) await writeIndex(next);
}

export { remove as delete };

export async function list() {
  const keys = await readIndex();
  return keys.map((key) => ({ key }));
}

/* Helpers de conveniência usados pelo app --------------------------------- */

export async function getJSON(key, fallback) {
  try {
    const res = await get(key);
    if (!res || !res.value) return fallback;
    return JSON.parse(res.value);
  } catch (e) {
    console.warn(`[storage] falha ao ler ${key}`, e);
    return fallback;
  }
}

export async function setJSON(key, value) {
  await set(key, JSON.stringify(value));
}

export const KEYS = {
  saved: "pokedex-saved",
  details: "pokedex-details",
  apiKey: "anthropic-api-key",
  proxyUrl: "anthropic-proxy-url",
  searchHistory: "search-history",
  lastBackup: "last-backup-at",
  lastTab: "last-tab",
  usageStats: "usage-stats",
  theme: "theme",
  gamification: "gamification",
  offlineQueue: "offline-search-queue",
  notificationsEnabled: "notifications-enabled",
  collections: "collections",
  suggestions: "related-suggestions",
  prefetchDetails: "prefetch-details-enabled",
  irrelevantItems: "irrelevant-items",
  effectProfiles: "effect-profiles",
  searchEffort: "search-effort",
};

export default { get, set, delete: remove, list, getJSON, setJSON, KEYS };
