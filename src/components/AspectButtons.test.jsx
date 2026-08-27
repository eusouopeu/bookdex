import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookOpen, Sparkles } from "lucide-react";
import AspectButtons, { BLUE_TINT } from "./AspectButtons";
import { MissingApiKeyError } from "../lib/anthropic";

const ASPECTS = [
  { id: "a", label: "Aspecto A", icon: BookOpen },
  { id: "b", label: "Aspecto B", icon: Sparkles },
];

describe("AspectButtons", () => {
  it("busca um aspecto ainda não gerado, expande o texto e avisa quem persiste", async () => {
    const onFetch = vi.fn().mockResolvedValue("Texto gerado sobre o aspecto A.");
    const onGenerated = vi.fn();
    const user = userEvent.setup();

    render(<AspectButtons aspects={ASPECTS} onFetch={onFetch} onGenerated={onGenerated} tint={BLUE_TINT} />);

    await user.click(screen.getByRole("button", { name: "Aspecto A (gera com IA)" }));

    expect(await screen.findByText("Texto gerado sobre o aspecto A.")).toBeInTheDocument();
    expect(onFetch).toHaveBeenCalledWith("a");
    expect(onGenerated).toHaveBeenCalledWith("a", "Texto gerado sobre o aspecto A.");
  });

  it("tocar de novo num aspecto já gerado só recolhe — não busca de novo", async () => {
    const onFetch = vi.fn().mockResolvedValue("Texto.");
    const user = userEvent.setup();

    render(<AspectButtons aspects={ASPECTS} onFetch={onFetch} tint={BLUE_TINT} />);

    const btn = screen.getByRole("button", { name: "Aspecto A (gera com IA)" });
    await user.click(btn);
    await screen.findByText("Texto.");
    expect(onFetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Aspecto A — mostrar/ocultar" }));
    expect(screen.queryByText("Texto.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aspecto A — mostrar/ocultar" }));
    expect(await screen.findByText("Texto.")).toBeInTheDocument();
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it("usa o texto já salvo sem chamar onFetch", async () => {
    const onFetch = vi.fn();
    const user = userEvent.setup();

    render(<AspectButtons aspects={ASPECTS} saved={{ a: "Já estava salvo." }} onFetch={onFetch} tint={BLUE_TINT} />);

    await user.click(screen.getByRole("button", { name: "Aspecto A — mostrar/ocultar" }));
    expect(await screen.findByText("Já estava salvo.")).toBeInTheDocument();
    expect(onFetch).not.toHaveBeenCalled();
  });

  it("mostra o aviso de chave ausente quando onFetch rejeita com MissingApiKeyError", async () => {
    const onFetch = vi.fn().mockRejectedValue(new MissingApiKeyError());
    const user = userEvent.setup();

    render(<AspectButtons aspects={ASPECTS} onFetch={onFetch} tint={BLUE_TINT} />);
    await user.click(screen.getByRole("button", { name: "Aspecto A (gera com IA)" }));

    expect(await screen.findByText("Configure sua API key em Configurações.")).toBeInTheDocument();
  });

  it("mostra o custo estimado no tooltip de um aspecto ainda não gerado", () => {
    render(<AspectButtons aspects={ASPECTS} onFetch={vi.fn()} tint={BLUE_TINT} costLabel="US$ 0,003" />);
    expect(screen.getByRole("button", { name: "Aspecto A (gera com IA)" })).toHaveAttribute(
      "title",
      "Aspecto A (~US$ 0,003)"
    );
  });
});
