import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/storage", async (importOriginal) => ({
  ...(await importOriginal()),
  ...(await import("../test/storageMock")).storageModuleMock(),
}));

import { seedStorage, storageState } from "../test/storageMock";
import ImportView from "./ImportView";
import { renderWithData } from "../test/renderWithData";

const PAYLOAD = JSON.stringify({
  saved: {
    respiracao: {
      displayName: "Técnicas de respiração",
      kind: "technique",
      techniques: [{ id: "diafragmatica", name: "Respiração diafragmática", description: "...", savedAt: 5 }],
    },
  },
  detailCache: {},
});

describe("ImportView", () => {
  beforeEach(() => {
    seedStorage({ "schema-version": 3 });
  });

  it("mostra o resumo antes de importar e só grava depois da confirmação", async () => {
    const user = userEvent.setup();
    renderWithData(<ImportView onBack={() => {}} />);

    await user.click(await screen.findByPlaceholderText('{"saved": { ... }, "detailCache": { ... }}'));
    await user.paste(PAYLOAD);
    await user.click(screen.getByRole("button", { name: "Revisar JSON colado" }));

    const confirm = await screen.findByRole("button", { name: /Confirmar importação/ });
    expect(storageState()["pokedex-saved"]).toBeUndefined();

    await user.click(confirm);

    expect(await screen.findByText(/assunto\(s\) novo\(s\)/)).toBeInTheDocument();
    const savedAfter = storageState()["pokedex-saved"];
    expect(Object.keys(savedAfter)).toEqual(["respiracao"]);
    expect(savedAfter.respiracao.items[0].kind).toBe("technique"); // payload legado normalizado
  });

  it("reclama de JSON inválido sem gravar nada", async () => {
    const user = userEvent.setup();
    renderWithData(<ImportView onBack={() => {}} />);

    await user.click(await screen.findByPlaceholderText('{"saved": { ... }, "detailCache": { ... }}'));
    await user.paste("{isso não é json}");
    await user.click(screen.getByRole("button", { name: "Revisar JSON colado" }));

    expect(await screen.findByText(/Isso não é um JSON válido/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar importação/ })).toBeNull();
    expect(storageState()["pokedex-saved"]).toBeUndefined();
  });
});
