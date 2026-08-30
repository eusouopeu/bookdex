import { describe, expect, it } from "vitest";
import { applyEnrichment, convertItem, missingFields, needsEnrichment } from "./convert";

const listItem = {
  id: "memoria-curta",
  kind: "list",
  name: "Memória de curto prazo",
  description: "Retém pouca informação por segundos.",
  category: "Cognição",
  tags: ["prova"],
  note: "revisar",
  savedAt: 42,
};

describe("convertItem", () => {
  it("preserva identidade e anotações ao virar conceito", () => {
    const converted = convertItem(listItem, "definition");
    expect(converted.id).toBe("memoria-curta");
    expect(converted.savedAt).toBe(42);
    expect(converted.tags).toEqual(["prova"]);
    expect(converted.note).toBe("revisar");
    expect(converted.kind).toBe("definition");
    expect(converted.convertedFrom).toBe("list");
  });

  it("mapeia nome/descrição para termo/definição e limpa campos do tipo antigo", () => {
    const converted = convertItem(listItem, "definition");
    expect(converted.term).toBe("Memória de curto prazo");
    expect(converted.definition).toBe("Retém pouca informação por segundos.");
    expect(converted.name).toBeUndefined();
    expect(converted.description).toBeUndefined();
  });

  it("ao virar técnica deixa stats vazias e usa a categoria como tipo", () => {
    const converted = convertItem(listItem, "technique");
    expect(converted.name).toBe("Memória de curto prazo");
    expect(converted.type).toBe("Cognição");
    expect(converted.stats).toEqual([]);
    expect(converted.statLabels).toEqual([]);
    expect(converted.bestFor).toBe("");
  });

  it("converte conceito de volta para tipo usando term/definition", () => {
    const concept = convertItem(listItem, "definition");
    const back = convertItem(concept, "list");
    expect(back.name).toBe("Memória de curto prazo");
    expect(back.description).toBe("Retém pouca informação por segundos.");
    expect(back.term).toBeUndefined();
    expect(back.keyPoints).toBeUndefined();
  });

  it("limpa aspectos gerados sob demanda — pertencem ao kind antigo", () => {
    const withAspects = { ...listItem, aspects: { deepDive: "algo" } };
    const converted = convertItem(withAspects, "definition");
    expect(converted.aspects).toBeUndefined();
  });

  it("é no-op quando o tipo de destino é o atual", () => {
    expect(convertItem(listItem, "list")).toBe(listItem);
  });
});

describe("missingFields / needsEnrichment", () => {
  it("aponta stats e bestFor numa técnica recém-convertida", () => {
    const converted = convertItem(listItem, "technique");
    expect(missingFields(converted)).toEqual(["stats", "bestFor"]);
    expect(needsEnrichment(converted)).toBe(true);
  });

  it("não oferece completar num item que nunca foi convertido", () => {
    expect(needsEnrichment({ kind: "technique", stats: [], statLabels: [] })).toBe(false);
  });

  it("considera completo um card com todos os campos", () => {
    const full = { kind: "technique", convertedFrom: "list", stats: [1], statLabels: ["a"], bestFor: "x" };
    expect(missingFields(full)).toEqual([]);
    expect(needsEnrichment(full)).toBe(false);
  });
});

describe("applyEnrichment", () => {
  it("preenche stats, bestFor e tipo da técnica e tira a marca de convertido", () => {
    const converted = convertItem(listItem, "technique");
    const enriched = applyEnrichment(converted, {
      statLabels: ["Rapidez", "Facilidade", "Eficácia", "Duração"],
      stats: [4, 3, 4, 2],
      bestFor: "Reter instruções curtas",
      type: "memoria",
    });
    expect(enriched.stats).toEqual([4, 3, 4, 2]);
    expect(enriched.bestFor).toBe("Reter instruções curtas");
    expect(enriched.type).toBe("memoria");
    expect(enriched.convertedFrom).toBeUndefined();
  });

  it("nunca sobrescreve conteúdo que o usuário já tinha", () => {
    const concept = { kind: "definition", convertedFrom: "list", definition: "minha definição", keyPoints: [], example: "" };
    const enriched = applyEnrichment(concept, { definition: "outra", keyPoints: ["a"], example: "ex" });
    expect(enriched.definition).toBe("minha definição");
    expect(enriched.keyPoints).toEqual(["a"]);
    expect(enriched.example).toBe("ex");
  });

  it("mantém a marca de convertido se ainda faltar campo", () => {
    const converted = convertItem(listItem, "technique");
    const enriched = applyEnrichment(converted, { bestFor: "algo" });
    expect(enriched.convertedFrom).toBe("list");
    expect(missingFields(enriched)).toEqual(["stats"]);
  });
});
