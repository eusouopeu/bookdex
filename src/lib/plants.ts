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

/**
 * Cronograma de cuidados — água e fertilização. Puro dado local (intervalo +
 * data da última vez), sem chamada de API: "em quantos dias" é cálculo direto
 * sobre esses dois campos, então uma planta salva sem cronograma configurado
 * simplesmente não mostra o card, sem precisar de migração de schema.
 */
export interface CareTaskState {
  enabled: boolean;
  intervalDays: number;
  lastDoneAt: number | null;
}

export interface CareSchedule {
  water?: CareTaskState;
  fertilize?: CareTaskState;
}

export const CARE_TASKS = [
  { id: "water", label: "Água", defaultIntervalDays: 7 },
  { id: "fertilize", label: "Fertilizar", defaultIntervalDays: 30 },
] as const;

export function defaultCareTask(taskId: string): CareTaskState {
  const def = CARE_TASKS.find((t) => t.id === taskId);
  return { enabled: true, intervalDays: def?.defaultIntervalDays || 7, lastDoneAt: null };
}

/**
 * Dias até a próxima vez (negativo = atrasado). Sem `lastDoneAt` ainda (nunca
 * marcado como feito), conta a partir de agora — "vence" daqui a
 * `intervalDays`, que é a única data que faz sentido ter por padrão.
 */
export function daysUntilDue(task: CareTaskState, now = Date.now()) {
  const last = task.lastDoneAt ?? now;
  const dueAt = last + task.intervalDays * 24 * 60 * 60 * 1000;
  return Math.ceil((dueAt - now) / (24 * 60 * 60 * 1000));
}
