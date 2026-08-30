import { describe, expect, it } from "vitest";
import { parseGoalInput } from "./goalSuggestions";

describe("goalSuggestions / parseGoalInput", () => {
  it("parses a '+' prefix as wanting more of the target", () => {
    expect(parseGoalInput("+ ressonância")).toEqual({ direction: "mais", target: "ressonância" });
  });

  it("parses a '-' prefix as wanting less of the target", () => {
    expect(parseGoalInput("- nasal")).toEqual({ direction: "menos", target: "nasal" });
  });

  it("works without a space after the sign", () => {
    expect(parseGoalInput("+ansiedade")).toEqual({ direction: "mais", target: "ansiedade" });
  });

  it("returns null without a leading + or -", () => {
    expect(parseGoalInput("ressonância")).toBeNull();
  });

  it("returns null for empty or sign-only input", () => {
    expect(parseGoalInput("")).toBeNull();
    expect(parseGoalInput("+")).toBeNull();
    expect(parseGoalInput("  -  ")).toBeNull();
  });
});
