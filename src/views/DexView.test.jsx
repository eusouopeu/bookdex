import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/storage", async (importOriginal) => ({
  ...(await importOriginal()),
  ...(await import("../test/storageMock")).storageModuleMock(),
}));

import { seedStorage } from "../test/storageMock";
import DexView from "./DexView";
import { renderWithData } from "../test/renderWithData";

const SEED = {
  "pokedex-saved": {
    respiracao: {
      displayName: "Técnicas de respiração",
      kind: "technique",
      techniques: [
        {
          id: "diafragmatica",
          name: "Respiração diafragmática",
          type: "calma",
          description: "Respirar usando o diafragma em vez do peito.",
          bestFor: "Uso diário",
          stats: [4, 5, 4, 3],
          statLabels: ["Rapidez", "Facilidade", "Eficácia", "Duração"],
          savedAt: 2,
          tags: ["ioga"],
          note: "",
        },
        {
          id: "box-breathing",
          name: "Box breathing",
          type: "foco",
          description: "Quatro tempos iguais de inspiração, pausa, expiração e pausa.",
          bestFor: "Ansiedade aguda",
          stats: [3, 3, 4, 2],
          statLabels: ["Rapidez", "Facilidade", "Eficácia", "Duração"],
          savedAt: 1,
          tags: [],
          note: "",
        },
      ],
    },
  },
  "schema-version": 2,
};

function renderDex(props = {}) {
  return renderWithData(
    <DexView
      category="technique"
      onCategoryChange={() => {}}
      onOpenDetail={() => {}}
      onOpenImport={() => {}}
      onSearchRelated={() => {}}
      onExampleSearch={() => {}}
      onOpenCompare={() => {}}
      showArchived={false}
      onToggleShowArchived={() => {}}
      searchEffort="medium"
      {...props}
    />
  );
}

describe("DexView", () => {
  beforeEach(() => {
    seedStorage(structuredClone(SEED));
  });

  it("lista os itens salvos agrupados pelo assunto", async () => {
    renderDex();
    expect(await screen.findByText("Respiração diafragmática")).toBeInTheDocument();
    expect(screen.getByText("Box breathing")).toBeInTheDocument();
    expect(screen.getByText(/Técnicas de respiração/)).toBeInTheDocument();
  });

  it("filtra por texto livre, incluindo o corpo do card", async () => {
    const user = userEvent.setup();
    renderDex();
    await screen.findByText("Respiração diafragmática");

    await user.type(screen.getByPlaceholderText("Buscar na sua Pokédex..."), "quatro tempos");

    await waitFor(() => expect(screen.queryByText("Respiração diafragmática")).not.toBeInTheDocument());
    expect(screen.getByText("Box breathing")).toBeInTheDocument();
  });

  it("no modo seleção usa checkbox dentro do card e conta os selecionados", async () => {
    const user = userEvent.setup();
    renderDex();
    await screen.findByText("Respiração diafragmática");

    await user.click(screen.getByRole("button", { name: "Selecionar vários itens" }));
    expect(screen.getByText("0 selecionado(s)")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Selecionar Respiração diafragmática" }));
    expect(screen.getByText("1 selecionado(s)")).toBeInTheDocument();
  });

  it("exige confirmação antes de excluir em massa e então remove o item", async () => {
    const user = userEvent.setup();
    renderDex();
    await screen.findByText("Box breathing");

    await user.click(screen.getByRole("button", { name: "Selecionar vários itens" }));
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Box breathing" }));

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(screen.getByText("Box breathing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar?" }));
    await waitFor(() => expect(screen.queryByText("Box breathing")).not.toBeInTheDocument());
    expect(screen.getByText("Respiração diafragmática")).toBeInTheDocument();
  });

  it("aplica uma tag a todos os itens selecionados", async () => {
    const user = userEvent.setup();
    renderDex();
    await screen.findByText("Box breathing");

    await user.click(screen.getByRole("button", { name: "Selecionar vários itens" }));
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Box breathing" }));
    await user.type(screen.getByPlaceholderText("tag..."), "foco");
    await user.click(screen.getByRole("button", { name: "Marcar" }));

    expect(await screen.findByRole("button", { name: "Remover tag foco" })).toBeInTheDocument();
  });
});
