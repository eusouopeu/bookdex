/**
 * Persistência do módulo Sinergia sobre o backend de storage compartilhado do
 * Cognidex (ver `src/lib/storage.ts`), namespaced com o prefixo original
 * "efeitosdex:" — não escreve em localStorage diretamente.
 */
import { createNamespacedStorage } from "../../../lib/storage";

const store = createNamespacedStorage("efeitosdex:");

export const get = store.get;
export const set = store.set;
export const getJSON = store.getJSON;
export const setJSON = store.setJSON;
export const list = store.list;
export const _delete = store.delete;
export { _delete as delete };
export { store as default };

export const KEYS = {
  apiKey: "anthropic-api-key",
  proxyUrl: "anthropic-proxy-url",
  usageStats: "usage-stats",
  monthlyBudget: "monthly-budget-usd",
  theme: "theme",
  effectProfiles: "effect-profiles",
  thinkingMode: "thinking-mode",
};
