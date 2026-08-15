import { describe, expect, it } from "vitest";
import {
  avoidListForSubject,
  initRelevanceState,
  isMarkedIrrelevant,
  markIrrelevant,
  tasteAvoidList,
  unmarkIrrelevant,
} from "./relevance";

describe("relevance", () => {
  it("marks an item as irrelevant under its subject and in the recent taste list", () => {
    let state = initRelevanceState();
    state = markIrrelevant(state, { subjectSlug: "respiracao", itemId: "4-7-8", name: "Respiração 4-7-8", mode: "technique", subjectDisplay: "Respiração" });
    expect(isMarkedIrrelevant(state, "respiracao", "4-7-8")).toBe(true);
    expect(avoidListForSubject(state, "respiracao")).toEqual(["Respiração 4-7-8"]);
    expect(tasteAvoidList(state)).toEqual(["Respiração 4-7-8"]);
  });

  it("unmarking removes it from both the subject list and the recent taste list", () => {
    let state = initRelevanceState();
    state = markIrrelevant(state, { subjectSlug: "respiracao", itemId: "4-7-8", name: "Respiração 4-7-8", mode: "technique", subjectDisplay: "Respiração" });
    state = unmarkIrrelevant(state, "respiracao", "4-7-8");
    expect(isMarkedIrrelevant(state, "respiracao", "4-7-8")).toBe(false);
    expect(avoidListForSubject(state, "respiracao")).toEqual([]);
  });

  it("keeps the taste list capped and most-recent-first", () => {
    let state = initRelevanceState();
    for (let i = 0; i < 30; i++) {
      state = markIrrelevant(state, { subjectSlug: `s${i}`, itemId: `i${i}`, name: `Item ${i}`, mode: "list", subjectDisplay: `Assunto ${i}` });
    }
    const taste = tasteAvoidList(state, 100);
    expect(taste.length).toBeLessThanOrEqual(25);
    expect(taste[0]).toBe("Item 29");
  });

  it("avoidListForSubject returns an empty list for an unknown subject", () => {
    expect(avoidListForSubject(initRelevanceState(), "nunca-visto")).toEqual([]);
  });
});
