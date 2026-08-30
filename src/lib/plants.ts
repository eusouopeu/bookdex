/**
 * Modelo dos itens do tipo "planta".
 *
 * Plantas não vêm de um "assunto" digitado como técnicas e conceitos: vêm de
 * um nome ou de uma foto. O agrupamento na Pokédex, então, é pela FAMÍLIA
 * botânica devolvida pela API — parentesco real, decidido sem o usuário ter
 * que inventar uma pasta. Sem família identificada, tudo cai em "Plantas".
 *
 * O id é o nome científico em slug, o que dá dedupe de graça: a mesma espécie
 * fotografada duas vezes cai no mesmo card em vez de virar duas entradas.
 */
import { slug } from "../theme";

export const PLANT_FALLBACK_GROUP = "Plantas";

export function plantGroupKey(plant) {
  return slug(plant?.family || PLANT_FALLBACK_GROUP) || slug(PLANT_FALLBACK_GROUP);
}

export function plantItemId(plant) {
  const base = slug(plant?.scientificName) || slug(plant?.commonNames?.[0]) || slug(plant?.name);
  return base || "planta";
}

/** Ficha vinda da API (ou já salva) na forma de item da Pokédex. */
export function plantToItem(plant, id = plantItemId(plant)) {
  return {
    id,
    kind: "plant",
    name: plant.commonNames?.[0] || plant.scientificName || "",
    scientificName: plant.scientificName || "",
    commonNames: plant.commonNames || [],
    family: plant.family || "",
    summary: plant.summary || "",
    idNote: plant.idNote || "",
    images: plant.images || [],
    aspects: plant.aspects || {},
    savedAt: Date.now(),
    tags: [],
    note: "",
  };
}

/** Texto livre de uma planta, para a busca dentro da Pokédex. */
export function plantFreeText(item) {
  return [item.scientificName, ...(item.commonNames || []), item.family, item.summary, item.idNote, ...Object.values(item.aspects || {})]
    .filter(Boolean)
    .join(" ");
}
