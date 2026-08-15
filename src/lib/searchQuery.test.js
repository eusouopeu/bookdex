import { describe, expect, it } from "vitest";
import { hasExplicitPrefix, parseSearchQuery } from "./searchQuery";

describe("searchQuery", () => {
  it("parses the def: prefix into definition mode", () => {
    expect(parseSearchQuery("def: efeito placebo")).toEqual({ mode: "definition", term: "efeito placebo" });
  });

  it("parses the list: prefix into list mode", () => {
    expect(parseSearchQuery("list: tipos de memória")).toEqual({ mode: "list", term: "tipos de memória" });
  });

  it("parses the tec: prefix into technique mode", () => {
    expect(parseSearchQuery("tec: respiração")).toEqual({ mode: "technique", term: "respiração" });
  });

  it("defaults to technique mode with no prefix", () => {
    expect(parseSearchQuery("respiração")).toEqual({ mode: "technique", term: "respiração" });
  });

  it("matches prefixes case-insensitively", () => {
    expect(parseSearchQuery("DEF: Juros compostos")).toEqual({ mode: "definition", term: "Juros compostos" });
  });

  it("hasExplicitPrefix reflects whether a recognized prefix was used", () => {
    expect(hasExplicitPrefix("def: algo")).toBe(true);
    expect(hasExplicitPrefix("algo")).toBe(false);
    expect(hasExplicitPrefix("")).toBe(false);
  });
});
