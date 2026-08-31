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
 * (Bookdex/Sinergia/Plantas) — estes são os 2-3 comportamentos essenciais
 * dessa mudança: módulo padrão correto, troca pro Sinergia funciona, troca
 * pras Plantas trava o modo de busca e some com o restante do picker.
 */
describe("toggle de módulos (Bookdex/Sinergia/Plantas)", () => {
  async function openModulePicker(user: ReturnType<typeof userEvent.setup>) {
    const toggle = await screen.findByRole("button", { name: /módulo atual: bookdex/i });
    await user.click(toggle);
  }

  it("abre no módulo Bookdex, com as 3 abas originais", async () => {
    renderWithData(<App />);
    expect(await screen.findByRole("button", { name: "BUSCAR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /POKÉDEX/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /COLEÇÕES/ })).toBeInTheDocument();
  });

  it("troca para o módulo Sinergia e mostra o conteúdo dele, escondendo as abas do Bookdex", async () => {
    const user = userEvent.setup();
    renderWithData(<App />);
    await openModulePicker(user);
    await user.click(await screen.findByRole("button", { name: "Sinergia" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Efeitos/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "BUSCAR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /COLEÇÕES/ })).not.toBeInTheDocument();
  });

  it("troca para o módulo Plantas: modo de busca trava em planta e a Pokédex some do seletor de categorias", async () => {
    const user = userEvent.setup();
    renderWithData(<App />);
    await openModulePicker(user);
    await user.click(await screen.findByRole("button", { name: "Plantas" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /identificar planta por foto/i })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /COLEÇÕES/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Técnicas" })).not.toBeInTheDocument();
  });
});
