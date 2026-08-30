/**
 * Storage em memória para os testes de view, no lugar do @capacitor/preferences.
 *
 * Uso no arquivo de teste:
 *
 *   vi.mock("../lib/storage", async (importOriginal) => ({
 *     ...(await importOriginal()),
 *     ...(await import("../test/storageMock")).storageModuleMock(),
 *   }));
 *
 * e `seedStorage({ [KEYS.saved]: ... })` antes de renderizar. As KEYS reais
 * continuam vindo do módulo original, então o teste não duplica esse mapa.
 */
let state = {};

export function seedStorage(values) {
  state = { ...values };
}

export function storageState() {
  return state;
}

export function storageModuleMock() {
  return {
    getJSON: async (key, fallback) => (key in state ? state[key] : fallback),
    setJSON: async (key, value) => {
      state[key] = value;
    },
    get: async (key) => (key in state ? { key, value: JSON.stringify(state[key]) } : null),
    set: async (key, value) => {
      state[key] = value;
    },
    list: async () => Object.keys(state).map((key) => ({ key })),
  };
}
