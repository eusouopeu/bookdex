/**
 * Backup local dos dados do app — perfis de efeito, tema e teto mensal. A API
 * key e o proxy NUNCA entram no backup (são segredos do aparelho, não dados
 * do usuário) — quem importar um backup em outro aparelho configura a chave
 * de novo lá.
 *
 * Importar tem TRÊS modos, porque substituir tudo em silêncio já significava
 * perder todo perfil criado depois do backup:
 *   - "mesclar"    (padrão): perfil do backup entra; mesmo id sobrescreve, o resto fica
 *   - "duplicar"   : tudo do backup entra com id novo e sufixo "(importado)"
 *   - "substituir" : comportamento antigo, apaga o que existe hoje
 */
import { getJSON, setJSON, KEYS } from "./storage";
import { initEffectProfiles, createProfileId } from "./effectProfiles";
import { migrateProfiles } from "./migrate";
import { slug } from "../theme";

const BACKUP_VERSION = 2;

export const IMPORT_MODES = [
  { key: "mesclar", label: "Mesclar", hint: "mantém os perfis atuais; mesmo perfil é sobrescrito" },
  { key: "duplicar", label: "Duplicar", hint: "entra como cópia, nada atual é tocado" },
  { key: "substituir", label: "Substituir", hint: "apaga todos os perfis atuais" },
];

export async function buildBackup() {
  const [effectProfiles, theme, monthlyBudget] = await Promise.all([
    getJSON(KEYS.effectProfiles, initEffectProfiles()),
    getJSON(KEYS.theme, "light"),
    getJSON(KEYS.monthlyBudget, 0),
  ]);
  return {
    app: "efeitosdex",
    version: BACKUP_VERSION,
    kind: "full",
    exportedAt: Date.now(),
    effectProfiles,
    theme,
    monthlyBudget,
  };
}

/** Backup de UM perfil só — o caso real de uso é passar um perfil pro outro aparelho, não o app inteiro. */
export function buildProfileBackup(profile: any) {
  return {
    app: "efeitosdex",
    version: BACKUP_VERSION,
    kind: "profile",
    exportedAt: Date.now(),
    effectProfiles: { [profile.id]: profile },
  };
}

export function downloadBackup(backup: any, nameHint?: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date(backup.exportedAt || Date.now()).toISOString().slice(0, 10);
  const suffix = nameHint ? `-${slug(nameHint)}` : "";
  const a = document.createElement("a");
  a.href = url;
  a.download = `efeitosdex${suffix}-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseBackupFile(text: string) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || !data.effectProfiles || typeof data.effectProfiles !== "object") {
    throw new Error("Arquivo não parece ser um backup do Efeitosdex.");
  }
  return data;
}

function duplicateProfiles(profiles: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const profile of Object.values(profiles)) {
    const id = createProfileId();
    out[id] = { ...(profile as any), id, name: `${(profile as any).name} (importado)` };
  }
  return out;
}

/**
 * Aplica um backup no modo escolhido. Sempre migra o que entra (backup antigo
 * pode não ter peso, meta, ligações...). Retorna quantos perfis foram
 * adicionados/atualizados e o total resultante.
 */
export async function applyBackup(data: any, mode = "mesclar") {
  const current = await getJSON(KEYS.effectProfiles, initEffectProfiles());
  const incoming = migrateProfiles(data.effectProfiles);

  let next;
  if (mode === "substituir") next = incoming;
  else if (mode === "duplicar") next = { ...current, ...duplicateProfiles(incoming) };
  else next = { ...current, ...incoming };

  await setJSON(KEYS.effectProfiles, next);
  if (mode === "substituir") {
    if (data.theme === "light" || data.theme === "dark") await setJSON(KEYS.theme, data.theme);
    if (typeof data.monthlyBudget === "number") await setJSON(KEYS.monthlyBudget, data.monthlyBudget);
  }
  return { imported: Object.keys(incoming).length, total: Object.keys(next).length };
}
