import { describe, expect, it } from "vitest";
import { findSimilarItem } from "./dedupe";

describe("dedupe", () => {
  const saved = {
    s1: { displayName: "Assunto 1", techniques: [{ id: "a", name: "Respiração 4-7-8" }] },
    "kn:s2": { displayName: "Vieses cognitivos", kind: "definition", items: [{ id: "efeito-placebo", term: "Efeito placebo" }] },
  };

  it("finds a match across subjects, ignoring case/accents via slug", () => {
    const found = findSimilarItem(saved, "efeito Placebo");
    expect(found).toEqual({ subjectDisplay: "Vieses cognitivos", name: "Efeito placebo" });
  });

  it("matches technique names too, not just definitions", () => {
    const found = findSimilarItem(saved, "respiração 4-7-8");
    expect(found.subjectDisplay).toBe("Assunto 1");
  });

  it("returns null when nothing matches", () => {
    expect(findSimilarItem(saved, "Algo totalmente novo")).toBeNull();
  });

  it("returns null for an empty/blank name", () => {
    expect(findSimilarItem(saved, "")).toBeNull();
  });
});
