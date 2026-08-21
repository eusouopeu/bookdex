import { describe, expect, it } from "vitest";
import { computeUnlocked, initGamificationState, recordVisit } from "./gamification";

const DAY_MS = 86400000;

describe("gamification", () => {
  it("recordVisit starts the streak at 1 on the first visit", () => {
    const now = Date.parse("2026-01-10T12:00:00Z");
    const state = recordVisit(null, now);
    expect(state.streak).toBe(1);
    expect(state.longestStreak).toBe(1);
  });

  it("recordVisit is a no-op if called again the same day", () => {
    const now = Date.parse("2026-01-10T12:00:00Z");
    const first = recordVisit(null, now);
    const second = recordVisit(first, now + 60_000);
    expect(second).toBe(first);
  });

  it("recordVisit increments the streak on a consecutive day", () => {
    const day1 = Date.parse("2026-01-10T12:00:00Z");
    let state = recordVisit(null, day1);
    state = recordVisit(state, day1 + DAY_MS);
    expect(state.streak).toBe(2);
    state = recordVisit(state, day1 + 2 * DAY_MS);
    expect(state.streak).toBe(3);
    expect(state.longestStreak).toBe(3);
  });

  it("recordVisit resets the streak to 1 after a skipped day", () => {
    const day1 = Date.parse("2026-01-10T12:00:00Z");
    let state = recordVisit(null, day1);
    state = recordVisit(state, day1 + DAY_MS);
    expect(state.streak).toBe(2);
    state = recordVisit(state, day1 + 5 * DAY_MS);
    expect(state.streak).toBe(1);
    expect(state.longestStreak).toBe(2);
  });


  it("computeUnlocked only unlocks achievements whose thresholds are met", () => {
    const state = { ...initGamificationState(), streak: 3 };
    const unlocked = computeUnlocked(state, 1);
    expect(unlocked).toContain("first-capture");
    expect(unlocked).toContain("streak-3");
    expect(unlocked).not.toContain("streak-7");
    expect(unlocked).not.toContain("collector-10");
  });
});
