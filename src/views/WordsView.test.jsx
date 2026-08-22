import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
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

  it("pronuncia a palavra na voz do idioma ao tocar no alto-falante", async () => {
    const speak = vi.fn();
    window.speechSynthesis = { speak, cancel: vi.fn(), getVoices: () => [{ lang: "zh-CN", name: "Tingting" }] };
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };

    const user = userEvent.setup();
    renderWithData(<WordsView searchEffort="medium" />);
    await user.click(await screen.findByRole("button", { name: "Ouvir a pronúncia de 好" }));

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0];
    expect(utterance.text).toBe("好");
    expect(utterance.lang).toBe("zh-CN");
    expect(utterance.voice).toEqual({ lang: "zh-CN", name: "Tingting" });
  });

  it("avisa quando o dispositivo não tem voz instalada para o idioma", async () => {
    window.speechSynthesis = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [{ lang: "pt-BR", name: "Luciana" }] };
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };

    const user = userEvent.setup();
    renderWithData(<WordsView searchEffort="medium" />);
    await user.click(await screen.findByRole("button", { name: "Ouvir a pronúncia de 好" }));

    expect(screen.getByText(/Nenhuma voz de Mandarim instalada/)).toBeInTheDocument();
  });
});
