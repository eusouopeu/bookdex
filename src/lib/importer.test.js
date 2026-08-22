import { describe, expect, it } from "vitest";
import {
  buildCollectionExportPayload,
  mergeCollections,
  mergeData,
  parsePayload,
  validatePayload,
} from "./importer";

describe("importer / validatePayload", () => {
  it("rejects invalid JSON shapes", () => {
    expect(() => validatePayload(null)).toThrow();
    expect(() => validatePayload([])).toThrow();
    expect(() => validatePayload({})).toThrow(/saved/);
  });

  it("rejects a subject group without an items array", () => {
    expect(() => validatePayload({ saved: { s1: { displayName: "X" } } })).toThrow(/formato inválido/);
  });

  it("accepts a well-formed payload with saved, detailCache and collections", () => {
    const payload = {
      saved: { s1: { displayName: "X", techniques: [] } },
      detailCache: {},
      collections: { c1: { name: "Col", refs: [] } },
    };
    expect(validatePayload(payload)).toBe(payload);
  });

  it("parsePayload throws a friendly error on malformed JSON text", () => {
    expect(() => parsePayload("{not json")).toThrow(/JSON válido/);
  });
});

describe("importer / mergeData", () => {
  const localSaved = {
    s1: {
      displayName: "Assunto 1",
      items: [{ id: "a", kind: "technique", name: "A", savedAt: 100 }],
    },
  };

  it("adds a brand-new subject and counts it as such", () => {
    const payload = { saved: { s2: { displayName: "Assunto 2", techniques: [{ id: "b", name: "B", savedAt: 50 }] } } };
    const { saved, stats } = mergeData(localSaved, {}, payload);
    expect(stats.newSubjects).toBe(1);
    expect(stats.newTechniques).toBe(1);
    expect(saved.s2.items[0].name).toBe("B");
    expect(saved.s2.items[0].kind).toBe("technique"); // grupo legado vira kind de item
    expect(saved.s1.items).toHaveLength(1); // não mexe no que já existia
  });

  it("keeps the local item when it is newer than the incoming one (duplicate)", () => {
    const payload = { saved: { s1: { displayName: "Assunto 1", techniques: [{ id: "a", name: "A velha", savedAt: 1 }] } } };
    const { saved, stats } = mergeData(localSaved, {}, payload);
    expect(stats.duplicateTechniques).toBe(1);
    expect(saved.s1.items[0].name).toBe("A");
  });

  it("replaces the local item when the incoming one is newer (update)", () => {
    const payload = { saved: { s1: { displayName: "Assunto 1", techniques: [{ id: "a", name: "A nova", savedAt: 999 }] } } };
    const { saved, stats } = mergeData(localSaved, {}, payload);
    expect(stats.updatedTechniques).toBe(1);
    expect(saved.s1.items[0].name).toBe("A nova");
  });

  it("normaliza um payload legado (grupo kn: com kind próprio) para itens com kind", () => {
    const payload = {
      saved: { "kn:s3": { displayName: "Assunto 3", kind: "list", items: [{ id: "c", name: "C", savedAt: 5 }] } },
    };
    const { saved } = mergeData(localSaved, {}, payload);
    expect(saved["kn:s3"].items[0].kind).toBe("list");
    expect(saved["kn:s3"].techniques).toBeUndefined();
  });

  it("merges detailCache, preserving whatever already exists locally", () => {
    const localDetails = { "s1:a": { overview: "local" } };
    const payload = { saved: {}, detailCache: { "s1:a": { overview: "incoming" }, "s1:x": { overview: "new" } } };
    const { detailCache, stats } = mergeData(localSaved, localDetails, payload);
    expect(detailCache["s1:a"].overview).toBe("local");
    expect(detailCache["s1:x"].overview).toBe("new");
    expect(stats.newDetails).toBe(1);
    expect(stats.duplicateDetails).toBe(1);
  });
});

describe("importer / mergeCollections", () => {
  it("adds a collection that doesn't exist locally yet", () => {
    const { collections, stats } = mergeCollections({}, { c1: { name: "Col", refs: [{ subjectKey: "s1", itemId: "a" }] } });
    expect(stats.newCollections).toBe(1);
    expect(collections.c1.refs).toHaveLength(1);
  });

  it("unions refs into a collection that already exists locally, never duplicating", () => {
    const local = { c1: { id: "c1", name: "Col", createdAt: 1, refs: [{ subjectKey: "s1", itemId: "a" }] } };
    const incoming = { c1: { name: "Col", refs: [{ subjectKey: "s1", itemId: "a" }, { subjectKey: "s1", itemId: "b" }] } };
    const { collections, stats } = mergeCollections(local, incoming);
    expect(stats.updatedCollections).toBe(1);
    expect(collections.c1.refs).toHaveLength(2);
  });
});

describe("importer / buildCollectionExportPayload", () => {
  it("packages only the items the collection actually references", () => {
    const saved = {
      s1: { displayName: "Assunto 1", techniques: [{ id: "a", name: "A" }, { id: "b", name: "B" }] },
      "kn:s2": { displayName: "Assunto 2", kind: "definition", items: [{ id: "c", term: "C" }] },
    };
    const detailCache = { "s1:a": { overview: "guia" } };
    const collection = { id: "col1", name: "Prova", createdAt: 1, refs: [{ subjectKey: "s1", itemId: "a" }, { subjectKey: "kn:s2", itemId: "c" }] };

    const payload = buildCollectionExportPayload("col1", collection, saved, detailCache);

    expect(payload.saved.s1.items.map((t) => t.id)).toEqual(["a"]); // "b" ficou de fora
    expect(payload.saved.s1.items[0].kind).toBe("technique");
    expect(payload.saved["kn:s2"].items.map((it) => it.id)).toEqual(["c"]);
    expect(payload.saved["kn:s2"].items[0].kind).toBe("definition");
    expect(payload.detailCache["s1:a"]).toBeDefined();
    expect(payload.collections.col1.refs).toEqual(collection.refs);
  });
});
