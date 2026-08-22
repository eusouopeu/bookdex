import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("../lib/storage", async (importOriginal) => ({
  ...(await importOriginal()),
  ...(await import("../test/storageMock")).storageModuleMock(),
}));

import { seedStorage } from "../test/storageMock";
import WordsView from "./WordsView";
import { renderWithData } from "../test/renderWithData";

const SEED = {
  "saved-words": {
    zh: {
      displayName: "Mandarim",
      words: [
        {
          id: "w-hao",
          word: "好",
          language: "Mandarim",
          languageCode: "zh",
          meaning: "bom, bem",
          pinyin: "hǎo",
          characters: [],
          savedAt: 1,
          tags: [],
          note: "",
        },
      ],
    },
  },
  "schema-version": 3,
};

describe("WordsView", () => {
  beforeEach(() => {
    seedStorage(structuredClone(SEED));
  });

  it("lista as palavras salvas agrupadas por idioma", async () => {
    renderWithData(<WordsView searchEffort="medium" />);
    expect(await screen.findByText("好")).toBeInTheDocument();
    expect(screen.getByText(/Mandarim/)).toBeInTheDocument();
    expect(screen.getByText("bom, bem")).toBeInTheDocument();
  });

});
