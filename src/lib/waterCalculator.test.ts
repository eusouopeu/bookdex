import { describe, expect, it } from "vitest";
import { estimateWatering, potVolumeMl } from "./waterCalculator";

describe("waterCalculator", () => {
  it("estima mais água pra vaso maior, com o mesmo tipo/estação", () => {
    const small = estimateWatering(10, "tropical", "mild");
    const big = estimateWatering(30, "tropical", "mild");
    expect(small).not.toBeNull();
    expect(big!.waterMl).toBeGreaterThan(small!.waterMl);
  });

  it("rega com mais frequência no verão do que no inverno", () => {
    const summer = estimateWatering(15, "tropical", "summer");
    const winter = estimateWatering(15, "tropical", "winter");
    expect(summer!.frequencyDays).toBeLessThan(winter!.frequencyDays);
  });

  it("retorna null pra entrada inválida em vez de gerar NaN/Infinity", () => {
    expect(estimateWatering(0, "tropical", "mild")).toBeNull();
    expect(estimateWatering(15, "planta-inexistente", "mild")).toBeNull();
    expect(estimateWatering(15, "tropical", "estacao-inexistente")).toBeNull();
  });

  it("volume do vaso cresce com o cubo do diâmetro (cilindro)", () => {
    expect(potVolumeMl(20)).toBeCloseTo(potVolumeMl(10) * 8, 0);
  });
});
