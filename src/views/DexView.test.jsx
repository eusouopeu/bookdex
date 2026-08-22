import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/storage", async (importOriginal) => ({
  ...(await importOriginal()),
  ...(await import("../test/storageMock")).storageModuleMock(),
}));

const enrichMock = vi.fn();
vi.mock("../lib/anthropic", async (importOriginal) => ({
  ...(await importOriginal()),
  hasCredentials: async () => false,
  fetchItemEnrichment: (...args) => enrichMock(...args),
}));

import { seedStorage, storageState } from "../test/storageMock";
import DexView from "./DexView";
import { usePrefs } from "../state/PrefsContext";
import { renderWithData } from "../test/renderWithData";

const SEED = {
  "pokedex-saved": {
    respiracao: {
      displayName: "Técnicas de respiração",
      items: [
        {
          id: "diafragmatica",
          kind: "technique",
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
          kind: "technique",
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
  "schema-version": 3,
};

const NOOP_PROPS = {
  onOpenDetail: () => {},
  onOpenImport: () => {},
  onSearchRelated: () => {},
  onExampleSearch: () => {},
  onOpenCompare: () => {},
};

/**
 * A categoria da Pokédex mora no PrefsContext (a barra de baixo, que a troca,
 * fica do outro lado da tela). O teste troca de aba pelo mesmo botão que o
 * usuário usaria — daí o `<CategorySwitch>` em volta da view.
 */
function CategorySwitch({ children }) {
  const { setDexCategory } = usePrefs();
  return (
    <>
      <button onClick={() => setDexCategory("knowledge")}>ir para conceitos</button>
      {children}
    </>
  );
}

function renderDex(props = {}) {
  return renderWithData(
    <CategorySwitch>
      <DexView {...NOOP_PROPS} {...props} />
    </CategorySwitch>
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

    await user.click(screen.getByRole("button", { name: "Excluir selecionados" }));
    expect(screen.getByText("Box breathing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
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
    await user.click(screen.getByRole("button", { name: "Marcar com a tag" }));

    expect(await screen.findByRole("button", { name: "Remover tag foco" })).toBeInTheDocument();
  });

  it("converte uma técnica em conceito: o card sai da aba Técnicas e reaparece em Conceitos", async () => {
    const user = userEvent.setup();
    renderDex();
    await screen.findByText("Box breathing");

    await user.click(screen.getAllByRole("button", { name: "Converter este card em outro tipo" })[1]);
    await user.click(screen.getByRole("button", { name: "Virar conceito" }));

    await waitFor(() => expect(screen.queryByText("Box breathing")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "ir para conceitos" }));
    expect(await screen.findByText("Box breathing")).toBeInTheDocument();
    expect(screen.getByText("CONCEITO")).toBeInTheDocument();
    expect(screen.queryByText("Respiração diafragmática")).not.toBeInTheDocument();
  });

  it("a conversão preserva tags e nota e o card convertido oferece completar com IA", async () => {
    const user = userEvent.setup();
    renderDex();
    await screen.findByText("Respiração diafragmática");

    // "Respiração diafragmática" tem a tag "ioga" e vira tipo
    await user.click(screen.getAllByRole("button", { name: "Converter este card em outro tipo" })[0]);
    await user.click(screen.getByRole("button", { name: "Virar tipo" }));

    await waitFor(() => expect(screen.queryByText("Respiração diafragmática")).not.toBeInTheDocument());
    const savedNow = storageState()["pokedex-saved"];
    const converted = savedNow.respiracao.items.find((it) => it.id === "diafragmatica");
    expect(converted.kind).toBe("list");
    expect(converted.tags).toEqual(["ioga"]);
    expect(converted.savedAt).toBe(2);
  });

  it("completar com IA preenche as barras da técnica convertida", async () => {
    enrichMock.mockResolvedValue({
      statLabels: ["Rapidez", "Facilidade", "Eficácia", "Duração"],
      stats: [4, 3, 5, 2],
      bestFor: "Decorar sequências",
      type: "memoria",
    });
    seedStorage({
      "pokedex-saved": {
        memoria: {
          displayName: "Memória",
          items: [
            {
              id: "palacio",
              kind: "technique",
              convertedFrom: "list",
              name: "Palácio da memória",
              description: "Associa itens a lugares.",
              type: "geral",
              bestFor: "",
              stats: [],
              statLabels: [],
              tags: [],
              note: "",
              savedAt: 1,
            },
          ],
        },
      },
      "schema-version": 3,
    });

    const user = userEvent.setup();
    renderDex();
    expect(await screen.findByText(/Card convertido — faltam/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Completar com IA/ }));

    expect(await screen.findByText("Rapidez")).toBeInTheDocument();
    expect(screen.getByText(/Ideal para: Decorar sequências/)).toBeInTheDocument();
    expect(screen.queryByText(/Card convertido —/)).not.toBeInTheDocument();
    expect(enrichMock).toHaveBeenCalledWith("technique", "Memória", expect.objectContaining({ id: "palacio" }));
  });
});
