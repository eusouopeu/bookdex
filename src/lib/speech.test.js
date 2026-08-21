import { describe, expect, it } from "vitest";
import { pickVoice, toBcp47 } from "./speech";

describe("toBcp47", () => {
  it("completa o código curto com a região padrão do idioma", () => {
    expect(toBcp47("zh")).toBe("zh-CN");
    expect(toBcp47("EN")).toBe("en-US");
  });

  it("mantém códigos que já vêm completos e devolve vazio pra entrada vazia", () => {
    expect(toBcp47("zh-TW")).toBe("zh-TW");
    expect(toBcp47("")).toBe("");
    expect(toBcp47(undefined)).toBe("");
  });

  it("devolve o próprio código quando o idioma não está no mapa", () => {
    expect(toBcp47("sw")).toBe("sw");
  });
});

describe("pickVoice", () => {
  const voices = [
    { lang: "pt-BR", name: "Luciana" },
    { lang: "zh-TW", name: "Meijia" },
    { lang: "en_US", name: "Samantha" },
  ];

  it("prefere a voz com o idioma exato", () => {
    expect(pickVoice(voices, "pt-BR").name).toBe("Luciana");
  });

  it("normaliza underscore e casa por região quando não há exato", () => {
    expect(pickVoice(voices, "en-GB").name).toBe("Samantha");
  });

  it("cai para outra região do mesmo idioma", () => {
    expect(pickVoice(voices, "zh-CN").name).toBe("Meijia");
  });

  it("devolve null quando não há voz do idioma", () => {
    expect(pickVoice(voices, "ja-JP")).toBeNull();
    expect(pickVoice([], "pt-BR")).toBeNull();
  });
});
