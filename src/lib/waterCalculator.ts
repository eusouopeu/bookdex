/**
 * Estimativa de quanta água dar e a cada quantos dias, a partir do diâmetro
 * do vaso, do tipo de planta e da estação — sem chamada de API, é só uma
 * conta. O vaso é aproximado como um cilindro com altura ~0.85× o diâmetro
 * (proporção comum de vaso de plástico/cerâmica); é estimativa, não receita —
 * a UI deixa isso explícito e recomenda ajustar pela observação do solo.
 */
export interface PlantWaterType {
  id: string;
  label: string;
  /** Fração do volume do vaso a regar de cada vez. */
  waterFraction: number;
  /** Intervalo entre regas em estação amena, antes do multiplicador sazonal. */
  baseFrequencyDays: number;
}

export const PLANT_WATER_TYPES: PlantWaterType[] = [
  { id: "succulent", label: "Suculenta / cacto", waterFraction: 0.1, baseFrequencyDays: 14 },
  { id: "tropical", label: "Folhagem tropical", waterFraction: 0.2, baseFrequencyDays: 6 },
  { id: "fern", label: "Samambaia / planta de sombra úmida", waterFraction: 0.25, baseFrequencyDays: 4 },
  { id: "woody", label: "Arbusto / árvore pequena em vaso", waterFraction: 0.15, baseFrequencyDays: 8 },
];

export interface WaterSeason {
  id: string;
  label: string;
  multiplier: number;
}

export const WATER_SEASONS: WaterSeason[] = [
  { id: "summer", label: "Verão", multiplier: 0.7 },
  { id: "mild", label: "Meia-estação", multiplier: 1 },
  { id: "winter", label: "Inverno", multiplier: 1.6 },
];

const POT_HEIGHT_RATIO = 0.85;

/** Volume aproximado do vaso, em mililitros. */
export function potVolumeMl(diameterCm: number) {
  const radius = diameterCm / 2;
  const height = diameterCm * POT_HEIGHT_RATIO;
  return Math.PI * radius * radius * height;
}

export interface WaterEstimate {
  waterMl: number;
  frequencyDays: number;
}

export function estimateWatering(diameterCm: number, typeId: string, seasonId: string): WaterEstimate | null {
  const type = PLANT_WATER_TYPES.find((t) => t.id === typeId);
  const season = WATER_SEASONS.find((s) => s.id === seasonId);
  if (!type || !season || !diameterCm || diameterCm <= 0) return null;
  const waterMl = potVolumeMl(diameterCm) * type.waterFraction;
  const frequencyDays = Math.max(1, Math.round(type.baseFrequencyDays * season.multiplier));
  return { waterMl: Math.round(waterMl), frequencyDays };
}
