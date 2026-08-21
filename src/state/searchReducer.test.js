import { describe, expect, it } from "vitest";
import { initialSearchState, searchReducer } from "./searchReducer";

function run(actions, from = initialSearchState) {
  return actions.reduce(searchReducer, from);
}

describe("searchReducer", () => {
  it("start limpa erro e pendência de chave, e fixa modo e termo", () => {
    const state = run([
      { type: "failure", error: "boom" },
      { type: "start", mode: "definition", term: "efeito placebo" },
    ]);
    expect(state).toMatchObject({ loading: true, error: null, needsKey: false, mode: "definition", query: "efeito placebo" });
  });

  it("success guarda o resultado e incrementa o contador de scans", () => {
    const state = run([
      { type: "start", mode: "list", term: "tipos de memória" },
      { type: "success", mode: "list", data: { items: [] } },
    ]);
    expect(state.loading).toBe(false);
    expect(state.result).toEqual({ mode: "list", data: { items: [] } });
    expect(state.scanCount).toBe(1);
  });

  it("failure destrava o loading e preserva o resultado anterior", () => {
    const state = run([
      { type: "start", mode: "technique", term: "a" },
      { type: "success", mode: "technique", data: { techniques: [] } },
      { type: "start", mode: "technique", term: "b" },
      { type: "failure", error: "sem rede" },
    ]);
    expect(state).toMatchObject({ loading: false, error: "sem rede" });
    expect(state.result).toEqual({ mode: "technique", data: { techniques: [] } });
    expect(state.scanCount).toBe(1);
  });

  it("missingKey sinaliza a falta de chave sem virar erro de busca", () => {
    const state = run([{ type: "start", mode: "technique", term: "a" }, { type: "missingKey" }]);
    expect(state).toMatchObject({ loading: false, needsKey: true, error: null });
    expect(searchReducer(state, { type: "clearNeedsKey" }).needsKey).toBe(false);
  });

  it("queuedOffline registra modo e termo sem entrar em loading", () => {
    const state = searchReducer(initialSearchState, { type: "queuedOffline", mode: "compare", term: "a, b" });
    expect(state).toMatchObject({ loading: false, mode: "compare", query: "a, b" });
  });

  it("ignora ações desconhecidas", () => {
    expect(searchReducer(initialSearchState, { type: "nope" })).toBe(initialSearchState);
  });
});
