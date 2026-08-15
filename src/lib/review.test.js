import { describe, expect, it } from "vitest";
import { countDue, getDueQueue, gradeReviewState, initReviewState, isDue } from "./review";

describe("review", () => {
  it("initReviewState starts due immediately, at box 0", () => {
    const now = 1000;
    const state = initReviewState(now);
    expect(state).toEqual({ box: 0, nextReviewAt: now });
    expect(isDue({ reviewState: state }, now)).toBe(true);
  });

  it("isDue treats a missing reviewState as due", () => {
    expect(isDue({}, Date.now())).toBe(true);
  });

  it("a correct grade advances the box and pushes the next review further out", () => {
    const now = 0;
    let state = initReviewState(now);
    state = gradeReviewState(state, true, now);
    expect(state.box).toBe(1);
    expect(state.nextReviewAt).toBeGreaterThan(now);
    const afterFirst = state.nextReviewAt;

    state = gradeReviewState(state, true, now);
    expect(state.box).toBe(2);
    expect(state.nextReviewAt).toBeGreaterThan(afterFirst);
  });

  it("a wrong grade resets the box back to 0", () => {
    const now = 0;
    let state = initReviewState(now);
    state = gradeReviewState(state, true, now);
    state = gradeReviewState(state, true, now);
    expect(state.box).toBeGreaterThan(0);
    state = gradeReviewState(state, false, now);
    expect(state.box).toBe(0);
  });

  it("the box never grows past the last configured interval", () => {
    const now = 0;
    let state = initReviewState(now);
    for (let i = 0; i < 20; i++) state = gradeReviewState(state, true, now);
    const capped = state.box;
    state = gradeReviewState(state, true, now);
    expect(state.box).toBe(capped);
  });

  it("getDueQueue only lists items whose nextReviewAt has passed, oldest first", () => {
    const now = 10_000;
    const saved = {
      "s1": {
        displayName: "Assunto 1",
        techniques: [
          { id: "a", name: "A", reviewState: { box: 0, nextReviewAt: now - 500 } },
          { id: "b", name: "B", reviewState: { box: 0, nextReviewAt: now + 500 } },
        ],
      },
      "kn:s2": {
        displayName: "Assunto 2",
        kind: "definition",
        items: [{ id: "c", term: "C", reviewState: { box: 0, nextReviewAt: now - 1000 } }],
      },
    };
    const queue = getDueQueue(saved, now);
    expect(queue.map((q) => q.name)).toEqual(["C", "A"]);
    expect(countDue(saved, now)).toBe(2);
  });
});
