/**
 * Versionamento do schema dos dados persistidos.
 *
 * Todo dado gravado pelo app (saved, detailCache, words, collections) carrega
 * uma versão única, guardada em `KEYS.schemaVersion`. Na abertura o app roda
 * as migrações pendentes em ordem, uma vez só, e regrava a versão nova. Assim
 * campos novos (ou removidos) deixam de depender de defaults espalhados pelo
 * código e de dados órfãos vindos de imports antigos.
 *
 * Para criar uma migração: adicione uma entrada em MIGRATIONS com a versão de
 * destino e uma função pura `(data) => data`, e suba CURRENT_SCHEMA_VERSION.
 */

export const CURRENT_SCHEMA_VERSION = 2;

function isKnowledgeKind(kind) {
  return kind === "definition" || kind === "list";
}

function mapItems(group, fn) {
  if (isKnowledgeKind(group.kind)) return { ...group, items: (group.items || []).map(fn) };
  return { ...group, techniques: (group.techniques || []).map(fn) };
}

/**
 * v1 — normaliza grupos legados: `kind` explícito, listas sempre presentes,
 * `tags`/`note` sempre definidos e `displayName` garantido.
 */
function toV1(data) {
  const saved = {};
  for (const [key, rawGroup] of Object.entries(data.saved || {})) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const kind = isKnowledgeKind(rawGroup.kind) ? rawGroup.kind : "technique";
    const group = {
      ...rawGroup,
      kind,
      displayName: rawGroup.displayName || key,
    };
    if (isKnowledgeKind(kind)) {
      group.items = Array.isArray(rawGroup.items) ? rawGroup.items : [];
      delete group.techniques;
    } else {
      group.techniques = Array.isArray(rawGroup.techniques) ? rawGroup.techniques : [];
      delete group.items;
    }
    saved[key] = mapItems(group, (item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : [],
      note: typeof item.note === "string" ? item.note : "",
    }));
  }

  const words = {};
  for (const [key, rawGroup] of Object.entries(data.words || {})) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    words[key] = {
      ...rawGroup,
      displayName: rawGroup.displayName || key,
      words: (Array.isArray(rawGroup.words) ? rawGroup.words : []).map((w) => ({
        ...w,
        tags: Array.isArray(w.tags) ? w.tags : [],
        note: typeof w.note === "string" ? w.note : "",
        characters: Array.isArray(w.characters) ? w.characters : [],
      })),
    };
  }

  return { ...data, saved, words };
}

/**
 * v2 — remove os campos das funcionalidades de revisão espaçada (`reviewState`)
 * e de vínculo manual entre cards (`links`), que saíram do app.
 */
function toV2(data) {
  const saved = {};
  for (const [key, group] of Object.entries(data.saved || {})) {
    saved[key] = mapItems(group, ({ reviewState, links, ...item }) => item);
  }
  return { ...data, saved };
}

const MIGRATIONS = [
  { version: 1, run: toV1 },
  { version: 2, run: toV2 },
];

/**
 * Aplica todas as migrações acima de `fromVersion`.
 * Retorna `{ data, version, migrated }` — `migrated` é false quando já estava
 * na versão atual, caso em que nada precisa ser regravado.
 */
export function runMigrations(data, fromVersion) {
  const from = Number.isInteger(fromVersion) ? fromVersion : 0;
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length === 0) {
    return { data, version: Math.max(from, CURRENT_SCHEMA_VERSION), migrated: false };
  }
  let next = data;
  for (const migration of pending) next = migration.run(next);
  return { data: next, version: CURRENT_SCHEMA_VERSION, migrated: true };
}
