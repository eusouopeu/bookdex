/**
 * Modelo usado pelo módulo Sinergia e seu preço: reexporta o catálogo
 * compartilhado com o Cognidex (`src/lib/models.ts`). Avaliar um item e
 * sugerir combinações exige julgamento comparativo, então fica fixo em
 * Sonnet — não há um modo de recuperação estruturada aqui que justificasse
 * Haiku.
 */
export { MODELS, PRICING, costOf } from "../../../lib/models";
import { MODELS } from "../../../lib/models";

export function modelFor() {
  return MODELS.sonnet;
}
