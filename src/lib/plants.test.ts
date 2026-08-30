import { describe, expect, it } from "vitest";
import { plantGroupKey, plantItemId, plantToItem, plantFreeText } from "./plants";

const ALECRIM = {
  scientificName: "Rosmarinus officinalis",
  commonNames: ["Alecrim", "Rosmaninho"],
  family: "Lamiaceae",
  summary: "Arbusto aromático.",
  idNote: "Parecida com a lavanda.",
};

describe("plants", () => {
  it("agrupa pela família e cai em 'plantas' quando ela não veio", () => {
    expect(plantGroupKey(ALECRIM)).toBe("lamiaceae");
    expect(plantGroupKey({ ...ALECRIM, family: "" })).toBe("plantas");
    expect(plantGroupKey(undefined)).toBe("plantas");
  });

  it("usa o nome científico como id, o que dedupa a mesma espécie", () => {
    expect(plantItemId(ALECRIM)).toBe("rosmarinus-officinalis");
    expect(plantItemId({ ...ALECRIM, commonNames: ["Outro nome"] })).toBe(plantItemId(ALECRIM));
  });

  it("cai pro nome popular quando não há nome científico", () => {
    expect(plantItemId({ commonNames: ["Boldo do Chile"] })).toBe("boldo-do-chile");
    expect(plantItemId({})).toBe("planta");
  });

  it("plantToItem produz um item de Pokédex completo e anotável", () => {
    const item = plantToItem(ALECRIM);
    expect(item).toMatchObject({
      id: "rosmarinus-officinalis",
      kind: "plant",
      name: "Alecrim",
      scientificName: "Rosmarinus officinalis",
      family: "Lamiaceae",
      idNote: "Parecida com a lavanda.",
      tags: [],
      note: "",
    });
    expect(item.images).toEqual([]);
    expect(item.aspects).toEqual({});
    expect(typeof item.savedAt).toBe("number");
  });

  it("o texto livre cobre nomes, família, resumo e aspectos já gerados", () => {
    const item = plantToItem({ ...ALECRIM, aspects: { medicinal: "Usada em chá digestivo." } });
    const text = plantFreeText(item);
    expect(text).toContain("Rosmarinus officinalis");
    expect(text).toContain("Rosmaninho");
    expect(text).toContain("Lamiaceae");
    expect(text).toContain("chá digestivo");
  });
});
