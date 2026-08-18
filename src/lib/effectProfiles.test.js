import { describe, expect, it } from "vitest";
import { clampRating, computeCombinedEffect, createCriterionId, createItemId } from "./effectProfiles";

describe("effectProfiles / clampRating", () => {
  it("clamps values to the -5..5 range", () => {
    expect(clampRating(8)).toBe(5);
    expect(clampRating(-9)).toBe(-5);
    expect(clampRating(3)).toBe(3);
  });

  it("rounds fractional values", () => {
    expect(clampRating(2.6)).toBe(3);
  });

  it("treats non-numeric input as 0", () => {
    expect(clampRating(undefined)).toBe(0);
    expect(clampRating("abc")).toBe(0);
  });
});

describe("effectProfiles / id helpers", () => {
  it("slugifies and de-duplicates criterion ids", () => {
    expect(createCriterionId([], "Energia")).toBe("energia");
    expect(createCriterionId(["energia"], "Energia")).toBe("energia-2");
  });

  it("slugifies and de-duplicates item ids", () => {
    expect(createItemId([], "Cafeína")).toBe("cafeina");
    expect(createItemId(["cafeina", "cafeina-2"], "Cafeína")).toBe("cafeina-3");
  });
});

describe("effectProfiles / computeCombinedEffect", () => {
  const profile = {
    criteria: [{ id: "energia", label: "Energia" }, { id: "ansiolitico", label: "Ansiolítico" }],
    items: [
      { id: "cafeina", active: true, ratings: { energia: 4, ansiolitico: -3 } },
      { id: "l-teanina", active: true, ratings: { energia: 1, ansiolitico: 3 } },
      { id: "alcool", active: false, ratings: { energia: -4, ansiolitico: 2 } }, // inativo, não deve contar
    ],
  };

  it("sums ratings only from active items, per criterion", () => {
    expect(computeCombinedEffect(profile)).toEqual({ energia: 5, ansiolitico: 0 });
  });

  it("ignores rating keys that aren't a current criterion", () => {
    const p2 = {
      criteria: [{ id: "energia", label: "Energia" }],
      items: [{ id: "x", active: true, ratings: { energia: 2, "critério-removido": 99 } }],
    };
    expect(computeCombinedEffect(p2)).toEqual({ energia: 2 });
  });

  it("returns zero for every criterion when there are no active items", () => {
    const p3 = { criteria: [{ id: "energia", label: "Energia" }], items: [] };
    expect(computeCombinedEffect(p3)).toEqual({ energia: 0 });
  });
});
