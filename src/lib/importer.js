/**
 * Validação e merge dos dados exportados pelo artefato original (claude.ai)
 * ou de outro dispositivo com o Bookdex.
 *
 * Formato esperado do payload:
 *   { saved: {...}, detailCache?: {...}, exportedAt?: number, version?: 1 }
 *
 * Cada grupo em `saved` é ou um grupo de técnicas (sem `kind`, ou `kind:
 * "technique"`, com um array `techniques`) ou um grupo de conhecimento
 * (`kind: "definition"` ou `"list"`, com um array `items`).
 */

function isTechniqueGroup(group) {
  return !group.kind || group.kind === "technique";
}

function itemsArrayOf(group) {
  return isTechniqueGroup(group) ? group.techniques : group.items;
}

export function parsePayload(rawText) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error("Isso não é um JSON válido. Copie o texto inteiro exportado.");
  }
  return validatePayload(payload);
}

export function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("O arquivo não tem o formato esperado (objeto JSON).");
  }
  if (!payload.saved || typeof payload.saved !== "object" || Array.isArray(payload.saved)) {
    throw new Error('O arquivo não contém o campo "saved" com os assuntos capturados.');
  }
  for (const [key, group] of Object.entries(payload.saved)) {
    if (!group || typeof group !== "object" || !Array.isArray(itemsArrayOf(group))) {
      throw new Error(`Assunto "${key}" está com formato inválido (sem lista de itens).`);
    }
  }
  if (
    payload.detailCache !== undefined &&
    (typeof payload.detailCache !== "object" || payload.detailCache === null || Array.isArray(payload.detailCache))
  ) {
    throw new Error('O campo "detailCache" está com formato inválido.');
  }
  return payload;
}

/**
 * Faz merge (nunca substituição) do payload importado sobre o estado local.
 * Em conflito de `id` dentro de um assunto, vence o item com `savedAt` maior.
 * No detailCache, chave já existente localmente é preservada (o guia não muda).
 */
export function mergeData(localSaved, localDetails, payload) {
  const saved = {};
  for (const [key, group] of Object.entries(localSaved || {})) {
    if (isTechniqueGroup(group)) {
      saved[key] = { displayName: group.displayName, kind: "technique", techniques: [...group.techniques] };
    } else {
      saved[key] = { displayName: group.displayName, kind: group.kind, items: [...group.items] };
    }
  }

  const stats = {
    newSubjects: 0,
    newTechniques: 0,
    updatedTechniques: 0,
    duplicateTechniques: 0,
    newDetails: 0,
    duplicateDetails: 0,
  };

  for (const [key, incoming] of Object.entries(payload.saved || {})) {
    const incomingIsTechnique = isTechniqueGroup(incoming);
    if (!saved[key]) {
      saved[key] = incomingIsTechnique
        ? { displayName: incoming.displayName || key, kind: "technique", techniques: [] }
        : { displayName: incoming.displayName || key, kind: incoming.kind, items: [] };
      stats.newSubjects++;
    }
    const group = saved[key];
    if (!group.displayName && incoming.displayName) group.displayName = incoming.displayName;

    const localItems = itemsArrayOf(group);
    for (const entry of itemsArrayOf(incoming) || []) {
      if (!entry || !entry.id) continue;
      const idx = localItems.findIndex((t) => t.id === entry.id);
      if (idx === -1) {
        localItems.push(entry);
        stats.newTechniques++;
      } else {
        const mine = localItems[idx];
        if ((entry.savedAt || 0) > (mine.savedAt || 0)) {
          localItems[idx] = entry;
          stats.updatedTechniques++;
        } else {
          stats.duplicateTechniques++;
        }
      }
    }
  }

  const detailCache = { ...(localDetails || {}) };
  for (const [key, value] of Object.entries(payload.detailCache || {})) {
    if (key in detailCache) {
      stats.duplicateDetails++;
    } else {
      detailCache[key] = value;
      stats.newDetails++;
    }
  }

  return { saved, detailCache, stats };
}

export function buildExportPayload(saved, detailCache) {
  return {
    saved: saved || {},
    detailCache: detailCache || {},
    exportedAt: Date.now(),
    version: 1,
  };
}
