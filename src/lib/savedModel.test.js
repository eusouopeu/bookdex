import { describe, expect, it } from "vitest";
import { groupItems, itemKind, itemLabel, listAllItems, withItems } from "./savedModel";

describe("savedModel", () => {
  it("lê itens do formato atual e dos dois formatos antigos", () => {
    expect(groupItems({ items: [{ id: "a" }] })).toHaveLength(1);
    expect(groupItems({ kind: "technique", techniques: [{ id: "b" }] })).toHaveLength(1);
    expect(groupItems({ displayName: "vazio" })).toEqual([]);
    expect(groupItems(undefined)).toEqual([]);
  });

  it("tira o kind do item e só cai pro grupo quando o item não tem", () => {
    expect(itemKind({ kind: "list" }, { kind: "definition" })).toBe("list");
    expect(itemKind({}, { kind: "definition" })).toBe("definition");
    expect(itemKind({}, {})).toBe("technique");
  });

  it("usa term nos conceitos e name no resto", () => {
    expect(itemLabel({ term: "Placebo" })).toBe("Placebo");
    expect(itemLabel({ name: "Pomodoro" })).toBe("Pomodoro");
    expect(itemLabel({})).toBe("");
  });

  it("withItems devolve a forma canônica, sem resquício do formato antigo", () => {
    const group = withItems({ displayName: "X", kind: "definition", techniques: [] }, [{ id: "a" }]);
    expect(group).toEqual({ displayName: "X", items: [{ id: "a" }] });
  });

  it("listAllItems achata assuntos mistos com kind e rótulo resolvidos", () => {
    const saved = {
      foco: {
        displayName: "Foco",
        items: [
          { id: "pomodoro", kind: "technique", name: "Pomodoro" },
          { id: "flow", kind: "definition", term: "Flow" },
        ],
      },
    };
    expect(listAllItems(saved).map((e) => [e.kind, e.label])).toEqual([
      ["technique", "Pomodoro"],
      ["definition", "Flow"],
    ]);
  });
});
