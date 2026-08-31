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
 *
 * `createNamespacedStorage(prefix)` monta uma instância isolada por prefixo —
 * usada aqui para o Bookdex (`tecnicadex:`) e pelo módulo Sinergia
 * (`efeitosdex:`), sobre o MESMO backend (Preferences), sem misturar chaves.
 */
import { Preferences } from "@capacitor/preferences";

let backend: "preferences" | "local" | null = null;

async function pickBackend() {
  if (backend) return backend;
  try {
    await Preferences.get({ key: "__storage_probe__" });
    backend = "preferences";
  } catch (e) {
    console.warn("[storage] Preferences indisponível, usando localStorage", e);
    backend = "local";
  }
  return backend;
}

async function rawGet(key: string) {
  if ((await pickBackend()) === "preferences") {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }
  return localStorage.getItem(key);
}

async function rawSet(key: string, value: string) {
  if ((await pickBackend()) === "preferences") {
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

async function rawRemove(key: string) {
  if ((await pickBackend()) === "preferences") {
    await Preferences.remove({ key });
    return;
  }
  localStorage.removeItem(key);
}

export function createNamespacedStorage(prefix: string) {
  const INDEX_KEY = prefix + "__keys__";

  async function readIndex(): Promise<string[]> {
    const raw = await rawGet(INDEX_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeIndex(keys: string[]) {
    await rawSet(INDEX_KEY, JSON.stringify(keys));
  }

  async function get(key: string) {
    const value = await rawGet(prefix + key);
    if (value === null || value === undefined) return null;
    return { key, value };
  }

  async function set(key: string, value: string) {
    await rawSet(prefix + key, value);
    const keys = await readIndex();
    if (!keys.includes(key)) {
      keys.push(key);
      await writeIndex(keys);
    }
  }

  async function remove(key: string) {
    await rawRemove(prefix + key);
    const keys = await readIndex();
    const next = keys.filter((k) => k !== key);
    if (next.length !== keys.length) await writeIndex(next);
  }

  async function list() {
    const keys = await readIndex();
    return keys.map((key) => ({ key }));
  }

  async function getJSON(key: string, fallback: any) {
    try {
      const res = await get(key);
      if (!res || !res.value) return fallback;
      return JSON.parse(res.value);
    } catch (e) {
      console.warn(`[storage] falha ao ler ${key}`, e);
      return fallback;
    }
  }

  async function setJSON(key: string, value: any) {
    await set(key, JSON.stringify(value));
  }

  return { get, set, delete: remove, list, getJSON, setJSON };
}

const store = createNamespacedStorage("tecnicadex:");

export const get = store.get;
export const set = store.set;
export const list = store.list;
export const getJSON = store.getJSON;
export const setJSON = store.setJSON;
export { store as default };
export const _delete = store.delete;
export { _delete as delete };

export const KEYS = {
  saved: "pokedex-saved",
  details: "pokedex-details",
  apiKey: "anthropic-api-key",
  proxyUrl: "anthropic-proxy-url",
  searchHistory: "search-history",
  lastBackup: "last-backup-at",
  lastTab: "last-tab",
  usageStats: "usage-stats",
  monthlyBudget: "monthly-budget-usd",
  theme: "theme",
  offlineQueue: "offline-search-queue",
  collections: "collections",
  prefetchDetails: "prefetch-details-enabled",
  irrelevantItems: "irrelevant-items",
  searchEffort: "search-effort",
  searchModels: "search-models",
  searchCache: "search-cache",
  words: "saved-words",
  schemaVersion: "schema-version",
  appModule: "app-module",
};
