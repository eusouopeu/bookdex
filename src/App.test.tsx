import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./lib/storage", async (importOriginal) => ({
  ...(await importOriginal()),
  ...(await import("./test/storageMock")).storageModuleMock(),
}));

import App from "./App";
import { renderWithData } from "./test/renderWithData";

/**
 * O botão do canto superior esquerdo virou o toggle dos três módulos
 * (Cognidex/Sinergidex/Vegedex) — estes são os 2-3 comportamentos essenciais
 * dessa mudança: módulo padrão correto, troca pro Sinergidex funciona, troca
 * pro Vegedex trava o modo de busca e some com o restante do picker.
 */
describe("toggle de módulos (Cognidex/Sinergidex/Vegedex)", () => {
  async function openModulePicker(user: ReturnType<typeof userEvent.setup>) {
    const toggle = await screen.findByRole("button", { name: /módulo atual: cognidex/i });
    await user.click(toggle);
  }

  it("abre no módulo Cognidex, com as 3 abas originais", async () => {
    renderWithData(<App />);
    expect(await screen.findByRole("button", { name: "BUSCAR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /POKÉDEX/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /COLEÇÕES/ })).toBeInTheDocument();
  });

  it("troca para o módulo Sinergidex e mostra o conteúdo dele, escondendo as abas do Cognidex", async () => {
    const user = userEvent.setup();
    renderWithData(<App />);
    await openModulePicker(user);
    await user.click(await screen.findByRole("button", { name: "Sinergidex" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /EFEITOS/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "BUSCAR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /COLEÇÕES/ })).not.toBeInTheDocument();
  });

  it("troca para o módulo Vegedex: modo de busca trava em planta e a Pokédex some do seletor de categorias", async () => {
    const user = userEvent.setup();
    renderWithData(<App />);
    await openModulePicker(user);
    await user.click(await screen.findByRole("button", { name: "Vegedex" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /identificar planta por foto/i })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "Técnicas" })).not.toBeInTheDocument();
  });
});
