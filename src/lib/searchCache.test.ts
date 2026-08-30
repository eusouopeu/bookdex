import { describe, expect, it } from "vitest";
import { cacheKey, readCache, writeCache, dropCache, countValid, TTL_MS, type CacheStore } from "./searchCache";

describe("searchCache", () => {
  it("a chave ignora ordem, caixa e acento dos critérios, mas separa o resto", () => {
    const base = { mode: "technique", term: "Respiração", criteria: ["Custo", "tempo"], effort: "medium", model: "m" };
    expect(cacheKey(base)).toBe(cacheKey({ ...base, criteria: ["tempo", "custo"] }));
    expect(cacheKey(base)).toBe(cacheKey({ ...base, term: "respiracao" }));

    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, mode: "list" }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, effort: "high" }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, model: "outro" }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, criteria: [] }));
  });

  it("lê a entrada gravada e devolve null depois do TTL", () => {
    const store = writeCache({}, "k", { ok: true }, 1000);
    expect(readCache(store, "k", 1000).data).toEqual({ ok: true });
    expect(readCache(store, "k", 1000 + TTL_MS)).not.toBeNull();
    expect(readCache(store, "k", 1000 + TTL_MS + 1)).toBeNull();
    expect(readCache(store, "inexistente", 1000)).toBeNull();
  });

  it("poda as entradas mais antigas ao passar do teto", () => {
    let store: CacheStore = {};
    for (let i = 0; i < 70; i++) store = writeCache(store, `k${i}`, i, 1000 + i);
    expect(Object.keys(store)).toHaveLength(60);
    expect(store.k0).toBeUndefined();
    expect(store.k69.data).toBe(69);
  });

  it("dropCache remove só a entrada pedida e não muta o store original", () => {
    const store = writeCache(writeCache({}, "a", 1), "b", 2);
    const next = dropCache(store, "a");
    expect(next.a).toBeUndefined();
    expect(next.b).toBeDefined();
    expect(store.a).toBeDefined();
  });

  it("countValid não conta o que já venceu", () => {
    let store = writeCache({}, "velha", 1, 0);
    store = writeCache(store, "nova", 2, TTL_MS);
    expect(countValid(store, TTL_MS + 10)).toBe(1);
  });
});
