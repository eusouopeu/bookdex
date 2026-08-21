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

    const tech = data.saved.respiracao;
    expect(tech.kind).toBe("technique");
    expect(tech.techniques[0].tags).toEqual([]);
    expect(tech.techniques[0].note).toBe("");
    expect(tech.techniques[0].reviewState).toBeUndefined();
    expect(tech.techniques[0].links).toBeUndefined();

    const list = data.saved["kn:memoria"];
    expect(list.items[0].tags).toEqual(["a"]);
    expect(list.items[0].reviewState).toBeUndefined();
    expect(list.techniques).toBeUndefined();

    expect(data.words.zh.displayName).toBe("zh");
    expect(data.words.zh.words[0].characters).toEqual([]);
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
    expect(data.saved.a.techniques[0].reviewState).toBeUndefined();
  });
});
