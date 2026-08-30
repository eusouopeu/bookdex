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

export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Os dados aqui são schemas legados de formato desconhecido/variável (v0 a
 * v3) — o objetivo das migrações é justamente normalizar essa forma solta,
 * então os tipos usados são deliberadamente permissivos (`any`) em vez de
 * modelar cada schema antigo.
 */
type MigrationData = any;

function isKnowledgeKind(kind: any) {
  return kind === "definition" || kind === "list";
}

function mapItems(group: any, fn: (item: any) => any) {
  if (isKnowledgeKind(group.kind)) return { ...group, items: (group.items || []).map(fn) };
  return { ...group, techniques: (group.techniques || []).map(fn) };
}

/**
 * v1 — normaliza grupos legados: `kind` explícito, listas sempre presentes,
 * `tags`/`note` sempre definidos e `displayName` garantido.
 */
function toV1(data: MigrationData): MigrationData {
  const saved: Record<string, any> = {};
  for (const [key, rawGroup] of Object.entries<any>(data.saved || {})) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const kind = isKnowledgeKind(rawGroup.kind) ? rawGroup.kind : "technique";
    const group: any = {
      ...rawGroup,
      kind,
      displayName: rawGroup.displayName || key,
    };
    // A lista pode chegar em `items` (formato atual, ou grupo de conhecimento
    // antigo) ou em `techniques` (grupo de técnica antigo) — o que existir é o
    // que vale, senão dados de um import mais novo seriam descartados aqui.
    const list = Array.isArray(rawGroup.techniques)
      ? rawGroup.techniques
      : Array.isArray(rawGroup.items)
        ? rawGroup.items
        : [];
    if (isKnowledgeKind(kind)) {
      group.items = list;
      delete group.techniques;
    } else {
      group.techniques = list;
      delete group.items;
    }
    saved[key] = mapItems(group, (item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : [],
      note: typeof item.note === "string" ? item.note : "",
    }));
  }

  const words: Record<string, any> = {};
  for (const [key, rawGroup] of Object.entries<any>(data.words || {})) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    words[key] = {
      ...rawGroup,
      displayName: rawGroup.displayName || key,
      words: (Array.isArray(rawGroup.words) ? rawGroup.words : []).map((w: any) => ({
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
function toV2(data: MigrationData): MigrationData {
  const saved: Record<string, any> = {};
  for (const [key, group] of Object.entries<any>(data.saved || {})) {
    saved[key] = mapItems(group, ({ reviewState, links, ...item }: any) => item);
  }
  return { ...data, saved };
}

/**
 * v3 — `kind` passa a ser do ITEM, não do grupo. Cada grupo vira
 * `{ displayName, items }` com itens de qualquer tipo misturados, e o prefixo
 * `kn:` some (o grupo de conhecimento é fundido no grupo de mesmo assunto).
 * Ids que colidem na fusão são renomeados com sufixo do tipo, e as refs das
 * coleções são reescritas para continuarem apontando pro item certo.
 */
function kindSuffix(kind: any) {
  return kind === "definition" ? "def" : kind === "list" ? "tipo" : "tec";
}

function toV3(data: MigrationData): MigrationData {
  const saved: Record<string, any> = {};
  const refMap = new Map<string, { subjectKey: string; itemId: string }>(); // "assuntoAntigo:idAntigo" -> { subjectKey, itemId }

  // Grupos sem prefixo primeiro: assim as técnicas preservam os ids atuais e
  // só os itens vindos de `kn:` são renomeados quando houver colisão.
  const entries = Object.entries<any>(data.saved || {}).sort(
    ([a], [b]) => Number(a.startsWith("kn:")) - Number(b.startsWith("kn:"))
  );

  for (const [key, group] of entries) {
    if (!group || typeof group !== "object") continue;
    const targetKey = key.startsWith("kn:") ? key.slice(3) : key;
    const groupKind = group.kind || "technique";
    const legacyItems = Array.isArray(group.items)
      ? group.items
      : Array.isArray(group.techniques)
        ? group.techniques
        : [];

    if (!saved[targetKey]) saved[targetKey] = { displayName: group.displayName || targetKey, items: [] };
    const target = saved[targetKey];
    const taken = new Set(target.items.map((it) => it.id));

    for (const item of legacyItems) {
      if (!item || !item.id) continue;
      const kind = item.kind || groupKind;
      let id = item.id;
      if (taken.has(id)) id = `${item.id}-${kindSuffix(kind)}`;
      let n = 2;
      while (taken.has(id)) id = `${item.id}-${kindSuffix(kind)}-${n++}`;
      taken.add(id);
      if (key !== targetKey || id !== item.id) {
        refMap.set(`${key}:${item.id}`, { subjectKey: targetKey, itemId: id });
      }
      const { kind: _ignored, ...rest } = item;
      target.items.push({ ...rest, id, kind });
    }
  }

  const collections: Record<string, any> = {};
  for (const [id, col] of Object.entries<any>(data.collections || {})) {
    if (!col) continue;
    collections[id] = {
      ...col,
      refs: (col.refs || []).map((ref: any) => refMap.get(`${ref.subjectKey}:${ref.itemId}`) || ref),
    };
  }

  return { ...data, saved, collections };
}

const MIGRATIONS = [
  { version: 1, run: toV1 },
  { version: 2, run: toV2 },
  { version: 3, run: toV3 },
];

/**
 * Aplica todas as migrações acima de `fromVersion`.
 * Retorna `{ data, version, migrated }` — `migrated` é false quando já estava
 * na versão atual, caso em que nada precisa ser regravado.
 */
export function runMigrations(data: MigrationData, fromVersion: number) {
  const from = Number.isInteger(fromVersion) ? fromVersion : 0;
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length === 0) {
    return { data, version: Math.max(from, CURRENT_SCHEMA_VERSION), migrated: false };
  }
  let next = data;
  for (const migration of pending) next = migration.run(next);
  return { data: next, version: CURRENT_SCHEMA_VERSION, migrated: true };
}
