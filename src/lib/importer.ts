/**
 * Validação e merge dos dados exportados pelo artefato original (claude.ai)
 * ou de outro dispositivo com o Cognidex.
 *
 * Formato esperado do payload:
 *   { saved: {...}, detailCache?: {...}, exportedAt?: number, version?: 1 }
 *
 * O merge aceita tanto o formato atual (grupo `{ displayName, items }` com
 * `kind` em cada item) quanto os antigos (grupo com `kind` próprio e array
 * `techniques` ou `items`, chave prefixada com `kn:`). O resultado sai sempre
 * na forma atual, e as migrações rodam por cima depois de mesclar —
 * é lá que chaves `kn:` antigas são fundidas e as refs de coleção reescritas.
 */
import { groupItems, itemKind, withItems, type SavedGroup, type SavedItem, type SavedState } from "./savedModel";
import type { Collection, CollectionsState } from "./collections";
import type { WordsState } from "./words";

/** Payload importado, ainda solto (validado só depois de `validatePayload`). */
export interface ImportPayload {
  saved: Record<string, any>;
  detailCache?: Record<string, unknown>;
  collections?: Record<string, any>;
  words?: Record<string, any>;
  /** Backup do módulo Sinergia (ver modules/sinergia/lib/backup.ts), quando o
   *  arquivo é um backup unificado gerado pelo botão "Salvar backup". */
  sinergia?: Record<string, any>;
  exportedAt?: number;
  version?: number;
}

function normalizedItems(group: SavedGroup | any): SavedItem[] {
  return groupItems(group).map((item) => ({ ...item, kind: itemKind(item, group) }));
}

export function parsePayload(rawText: string): ImportPayload {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error("Isso não é um JSON válido. Copie o texto inteiro exportado.");
  }
  return validatePayload(payload);
}

export function validatePayload(payload: unknown): ImportPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("O arquivo não tem o formato esperado (objeto JSON).");
  }
  const p = payload as Record<string, any>;
  if (!p.saved || typeof p.saved !== "object" || Array.isArray(p.saved)) {
    throw new Error('O arquivo não contém o campo "saved" com os assuntos capturados.');
  }
  for (const [key, group] of Object.entries<any>(p.saved)) {
    const hasItemList = group && typeof group === "object" && (Array.isArray(group.items) || Array.isArray(group.techniques));
    if (!hasItemList) {
      throw new Error(`Assunto "${key}" está com formato inválido (sem lista de itens).`);
    }
  }
  if (
    p.detailCache !== undefined &&
    (typeof p.detailCache !== "object" || p.detailCache === null || Array.isArray(p.detailCache))
  ) {
    throw new Error('O campo "detailCache" está com formato inválido.');
  }
  if (
    p.collections !== undefined &&
    (typeof p.collections !== "object" || p.collections === null || Array.isArray(p.collections))
  ) {
    throw new Error('O campo "collections" está com formato inválido.');
  }
  if (p.words !== undefined && (typeof p.words !== "object" || p.words === null || Array.isArray(p.words))) {
    throw new Error('O campo "words" está com formato inválido.');
  }
  return p as ImportPayload;
}

/**
 * Faz merge de coleções manuais importadas sobre as locais. Coleção com `id`
 * já existente localmente tem suas refs UNIDAS (nunca substituídas); coleção
 * nova é adicionada como está.
 */
export function mergeCollections(
  localCollections: CollectionsState | undefined | null,
  incomingCollections: Record<string, any> | undefined | null
) {
  const collections: CollectionsState = { ...(localCollections || {}) };
  const stats = { newCollections: 0, updatedCollections: 0 };
  for (const [id, incoming] of Object.entries<any>(incomingCollections || {})) {
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
 * Faz merge (nunca substituição) de palavras importadas sobre as locais.
 * Mesma regra do merge de técnicas: `id` já existente localmente vence por
 * `savedAt` mais recente; grupo de idioma novo é criado sob demanda.
 */
export function mergeWords(localWords: WordsState | undefined | null, incomingWords: Record<string, any> | undefined | null) {
  const words: WordsState = {};
  for (const [key, group] of Object.entries(localWords || {})) {
    words[key] = { displayName: group.displayName, words: [...(group.words || [])] };
  }

  const stats = { newWords: 0, updatedWords: 0, duplicateWords: 0 };

  for (const [key, incoming] of Object.entries<any>(incomingWords || {})) {
    if (!incoming || !Array.isArray(incoming.words)) continue;
    if (!words[key]) words[key] = { displayName: incoming.displayName || key, words: [] };
    const group = words[key];
    for (const entry of incoming.words) {
      if (!entry || !entry.id) continue;
      const idx = group.words.findIndex((w) => w.id === entry.id);
      if (idx === -1) {
        group.words.push(entry);
        stats.newWords++;
      } else if ((entry.savedAt || 0) > (group.words[idx].savedAt || 0)) {
        group.words[idx] = entry;
        stats.updatedWords++;
      } else {
        stats.duplicateWords++;
      }
    }
  }

  return { words, stats };
}

/**
 * Faz merge (nunca substituição) do payload importado sobre o estado local.
 * Em conflito de `id` dentro de um assunto, vence o item com `savedAt` maior.
 * No detailCache, chave já existente localmente é preservada (o guia não muda).
 */
export function mergeData(
  localSaved: SavedState | undefined | null,
  localDetails: Record<string, any> | undefined | null,
  payload: ImportPayload
) {
  const saved: SavedState = {};
  for (const [key, group] of Object.entries(localSaved || {})) {
    saved[key] = withItems(group, normalizedItems(group));
  }

  const stats = {
    newSubjects: 0,
    newTechniques: 0,
    updatedTechniques: 0,
    duplicateTechniques: 0,
    newDetails: 0,
    duplicateDetails: 0,
  };

  for (const [key, incoming] of Object.entries<any>(payload.saved || {})) {
    if (!saved[key]) {
      saved[key] = { displayName: incoming.displayName || key, items: [] };
      stats.newSubjects++;
    }
    const group = saved[key];
    if (!group.displayName && incoming.displayName) group.displayName = incoming.displayName;

    const localItems = group.items as SavedItem[];
    for (const entry of normalizedItems(incoming)) {
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

/**
 * Backup completo do aparelho: `collections` e `words` (além de `saved` e
 * `detailCache`) entram por padrão — antes ficavam de fora do backup e
 * sumiam silenciosamente numa restauração em outro aparelho.
 */
export function buildExportPayload(
  saved: SavedState,
  detailCache: Record<string, unknown>,
  collections?: CollectionsState,
  words?: WordsState
) {
  return {
    saved: saved || {},
    detailCache: detailCache || {},
    collections: collections || {},
    words: words || {},
    exportedAt: Date.now(),
    version: 1,
  };
}

/**
 * Empacota UMA coleção manual pra compartilhar com outro usuário: a coleção
 * em si, mais os itens de `saved` (e seus guias em `detailCache`, se houver)
 * que ela referencia — sem levar o resto da Pokédex junto.
 */
export function buildCollectionExportPayload(
  collectionId: string,
  collection: Collection,
  saved: SavedState,
  detailCache: Record<string, unknown>
) {
  const packagedSaved: SavedState = {};
  const packagedDetails: Record<string, unknown> = {};
  for (const ref of collection.refs || []) {
    const group = saved[ref.subjectKey];
    if (!group) continue;
    const item = normalizedItems(group).find((it) => it.id === ref.itemId);
    if (!item) continue;
    if (!packagedSaved[ref.subjectKey]) packagedSaved[ref.subjectKey] = withItems(group, []);
    packagedSaved[ref.subjectKey].items.push(item);
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
