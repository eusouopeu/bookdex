/**
 * Espelha a Pokédex inteira em `.md` na pasta Documentos do aparelho, sem
 * botão nem confirmação — substitui o antigo export manual de Markdown.
 * Só roda no Android/iOS nativo (Capacitor.isNativePlatform()); no
 * navegador/PWA não há pasta de Documentos pra escrever, então essa função
 * não faz nada e o app segue como sempre foi lá.
 *
 * Debounced: `saved`/`detailCache` mudam a cada tecla de nota, cada
 * favoritar — regravar o arquivo inteiro a cada mudança seria caro e inútil.
 * Espera o usuário parar de mexer por alguns segundos antes de escrever.
 */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { buildPokedexMarkdown } from "./markdownExport";
import type { SavedState } from "./savedModel";

const MIRROR_PATH = "Cognidex/cognidex-pokedex.md";
const DEBOUNCE_MS = 4000;

let timer: ReturnType<typeof setTimeout> | null = null;

async function writeNow(saved: SavedState, detailCache: Record<string, unknown>) {
  try {
    const md = buildPokedexMarkdown(saved, detailCache);
    await Filesystem.writeFile({ path: MIRROR_PATH, data: md, directory: Directory.Documents, recursive: true });
  } catch (e) {
    console.warn("[autoMdMirror] falha ao gravar espelho .md", e);
  }
}

export function scheduleMdMirror(saved: SavedState, detailCache: Record<string, unknown>) {
  if (!Capacitor.isNativePlatform()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    writeNow(saved, detailCache);
  }, DEBOUNCE_MS);
}
