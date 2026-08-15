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
  if (
    payload.collections !== undefined &&
    (typeof payload.collections !== "object" || payload.collections === null || Array.isArray(payload.collections))
  ) {
    throw new Error('O campo "collections" está com formato inválido.');
  }
  return payload;
}

/**
 * Faz merge de coleções manuais importadas sobre as locais. Coleção com `id`
 * já existente localmente tem suas refs UNIDAS (nunca substituídas); coleção
 * nova é adicionada como está.
 */
export function mergeCollections(localCollections, incomingCollections) {
  const collections = { ...(localCollections || {}) };
  const stats = { newCollections: 0, updatedCollections: 0 };
  for (const [id, incoming] of Object.entries(incomingCollections || {})) {
    if (!incoming || !Array.isArray(incoming.refs)) continue;
    const existing = collections[id];
    if (!existing) {
      collections[id] = { id, name: incoming.name || id, createdAt: incoming.createdAt || Date.now(), refs: [...incoming.refs] };
      stats.newCollections++;
    } else {
      const existingKeys = new Set(existing.refs.map((r) => `${r.subjectKey}:${r.itemId}`));
      const merged = [...existing.refs];
      let changed = false;
      for (const r of incoming.refs) {
        const k = `${r.subjectKey}:${r.itemId}`;
        if (!existingKeys.has(k)) {
          merged.push(r);
          existingKeys.add(k);
          changed = true;
        }
      }
      collections[id] = { ...existing, refs: merged };
      if (changed) stats.updatedCollections++;
    }
  }
  return { collections, stats };
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

function itemsArrayOfKind(kind) {
  return kind === "definition" || kind === "list" ? "items" : "techniques";
}

/**
 * Empacota UMA coleção manual pra compartilhar com outro usuário: a coleção
 * em si, mais os itens de `saved` (e seus guias em `detailCache`, se houver)
 * que ela referencia — sem levar o resto da Pokédex junto.
 */
export function buildCollectionExportPayload(collectionId, collection, saved, detailCache) {
  const packagedSaved = {};
  const packagedDetails = {};
  for (const ref of collection.refs || []) {
    const group = saved[ref.subjectKey];
    if (!group) continue;
    const field = itemsArrayOfKind(group.kind);
    const item = (group[field] || []).find((it) => it.id === ref.itemId);
    if (!item) continue;
    if (!packagedSaved[ref.subjectKey]) {
      packagedSaved[ref.subjectKey] = group.kind && group.kind !== "technique"
        ? { displayName: group.displayName, kind: group.kind, items: [] }
        : { displayName: group.displayName, kind: "technique", techniques: [] };
    }
    packagedSaved[ref.subjectKey][field].push(item);
    const detailKey = `${ref.subjectKey}:${ref.itemId}`;
    if (detailCache && detailCache[detailKey]) packagedDetails[detailKey] = detailCache[detailKey];
  }
  return {
    saved: packagedSaved,
    detailCache: packagedDetails,
    collections: { [collectionId]: { id: collectionId, name: collection.name, createdAt: collection.createdAt, refs: collection.refs } },
    exportedAt: Date.now(),
    version: 1,
  };
}
