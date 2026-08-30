import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, runMigrations } from "./migrations";

const legacy = {
  saved: {
    respiracao: {
      displayName: "Técnicas de respiração",
      techniques: [{ id: "diafragmatica", name: "Diafragmática", reviewState: { box: 2 }, links: [{ subjectKey: "x" }] }],
    },
    "kn:memoria": {
      displayName: "Tipos de memória",
      kind: "list",
      items: [{ id: "curta", name: "Curta", tags: ["a"], reviewState: { box: 0 } }],
    },
  },
  detailCache: {},
  words: { zh: { words: [{ id: "w", word: "好" }] } },
  collections: {},
};

describe("runMigrations", () => {
  it("normaliza grupos legados e remove campos de revisão e vínculo", () => {
    const { data, version, migrated } = runMigrations(legacy, 0);
    expect(migrated).toBe(true);
    expect(version).toBe(CURRENT_SCHEMA_VERSION);

    const tech = data.saved.respiracao.items[0];
    expect(tech.kind).toBe("technique");
    expect(tech.tags).toEqual([]);
    expect(tech.note).toBe("");
    expect(tech.reviewState).toBeUndefined();
    expect(tech.links).toBeUndefined();

    const listItem = data.saved.memoria.items[0];
    expect(listItem.kind).toBe("list");
    expect(listItem.tags).toEqual(["a"]);
    expect(listItem.reviewState).toBeUndefined();
    expect(data.saved["kn:memoria"]).toBeUndefined();
    expect(data.saved.memoria.techniques).toBeUndefined();

    expect(data.words.zh.displayName).toBe("zh");
    expect(data.words.zh.words[0].characters).toEqual([]);
  });

  it("funde o grupo kn: no assunto de mesmo nome, renomeia id repetido e reescreve as refs", () => {
    const source = {
      saved: {
        foco: { displayName: "Foco", kind: "technique", techniques: [{ id: "pomodoro", name: "Pomodoro", savedAt: 1 }] },
        "kn:foco": { displayName: "Foco", kind: "definition", items: [{ id: "pomodoro", term: "Pomodoro", savedAt: 2 }] },
      },
      detailCache: {},
      words: {},
      collections: {
        c1: { id: "c1", name: "Prova", refs: [{ subjectKey: "kn:foco", itemId: "pomodoro" }, { subjectKey: "foco", itemId: "pomodoro" }] },
      },
    };
    const { data } = runMigrations(source, 0);

    const ids = data.saved.foco.items.map((it) => [it.id, it.kind]);
    expect(ids).toEqual([
      ["pomodoro", "technique"],
      ["pomodoro-def", "definition"],
    ]);
    expect(data.collections.c1.refs).toEqual([
      { subjectKey: "foco", itemId: "pomodoro-def" },
      { subjectKey: "foco", itemId: "pomodoro" },
    ]);
  });

  it("não mexe em dados já na versão atual", () => {
    const current = { saved: {}, detailCache: {}, words: {}, collections: {} };
    const result = runMigrations(current, CURRENT_SCHEMA_VERSION);
    expect(result.migrated).toBe(false);
    expect(result.data).toBe(current);
  });

  it("aplica só as migrações pendentes a partir de uma versão intermediária", () => {
    const v1 = {
      saved: { a: { displayName: "A", kind: "technique", techniques: [{ id: "t", tags: [], note: "", reviewState: { box: 1 } }] } },
      detailCache: {},
      words: {},
      collections: {},
    };
    const { data, migrated } = runMigrations(v1, 1);
    expect(migrated).toBe(true);
    expect(data.saved.a.items[0].reviewState).toBeUndefined();
    expect(data.saved.a.items[0].kind).toBe("technique");
  });
});
