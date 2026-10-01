import { setJSON } from "../../lib/storage";

/** Grava em background; falha só loga — o estado em memória continua valendo nesta sessão. */
export function persist(key: string, value: unknown) {
  setJSON(key, value).catch((e) => console.error(`Falha ao gravar ${key}`, e));
}
