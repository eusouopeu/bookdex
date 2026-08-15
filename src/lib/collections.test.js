import { describe, expect, it } from "vitest";
import { refKey, resolveCollectionItems } from "./collections";

describe("collections", () => {
  const saved = {
    s1: { displayName: "Assunto 1", techniques: [{ id: "a", name: "A" }] },
    "kn:s2": { displayName: "Assunto 2", kind: "definition", items: [{ id: "b", term: "B" }] },
  };

  it("resolves refs against the current saved state", () => {
    const refs = [{ subjectKey: "s1", itemId: "a" }, { subjectKey: "kn:s2", itemId: "b" }];
    const resolved = resolveCollectionItems(saved, refs);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].item.name).toBe("A");
    expect(resolved[0].kind).toBe("technique");
    expect(resolved[1].item.term).toBe("B");
    expect(resolved[1].kind).toBe("definition");
  });

  it("silently drops orphaned refs (subject or item no longer saved)", () => {
    const refs = [
      { subjectKey: "s1", itemId: "a" },
      { subjectKey: "s1", itemId: "does-not-exist" },
      { subjectKey: "subject-removed", itemId: "x" },
    ];
    const resolved = resolveCollectionItems(saved, refs);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].item.id).toBe("a");
  });

  it("refKey combines subjectKey and itemId into a stable identifier", () => {
    expect(refKey({ subjectKey: "s1", itemId: "a" })).toBe("s1:a");
  });
});
