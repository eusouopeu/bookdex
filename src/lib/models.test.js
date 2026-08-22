import { describe, expect, it } from "vitest";
import { MODELS, modelFor, defaultSearchTiers, SEARCH_MODE_TIERS, costOf } from "./models";

describe("models", () => {
  it("tarefas que não são busca têm modelo fixo, ignorando a preferência do usuário", () => {
    const tiers = { technique: "haiku", definition: "haiku", list: "haiku", compare: "haiku", plant: "haiku" };
    expect(modelFor("detail", tiers)).toBe(MODELS.sonnet);
    expect(modelFor("plantAspect", tiers)).toBe(MODELS.sonnet);
    expect(modelFor("word", tiers)).toBe(MODELS.haiku);
    expect(modelFor("enrichment", tiers)).toBe(MODELS.haiku);
  });

  it("modos de busca seguem a escolha do usuário e, sem ela, o padrão do modo", () => {
    expect(modelFor("technique", { technique: "haiku" })).toBe(MODELS.haiku);
    expect(modelFor("technique", {})).toBe(MODELS.sonnet);
    expect(modelFor("list", {})).toBe(MODELS.haiku);
    expect(modelFor("technique", undefined)).toBe(MODELS.sonnet);
  });

  it("tarefa desconhecida não derruba nada: cai em Sonnet", () => {
    expect(modelFor("inventada")).toBe(MODELS.sonnet);
  });

  it("os padrões cobrem exatamente os modos de busca configuráveis", () => {
    expect(Object.keys(defaultSearchTiers()).sort()).toEqual(SEARCH_MODE_TIERS.map((m) => m.mode).sort());
  });

  it("Haiku custa uma fração do Sonnet no mesmo consumo", () => {
    expect(costOf(MODELS.haiku, 1e6, 1e6)).toBeLessThan(costOf(MODELS.sonnet, 1e6, 1e6));
    expect(costOf(MODELS.sonnet, 1e6, 1e6)).toBeCloseTo(18, 5);
  });
});
