/**
 * Pronúncia das palavras salvas via `speechSynthesis` do próprio sistema —
 * offline, sem custo de API e sem depender de arquivo de áudio.
 *
 * O código de idioma vindo da API é curto ("zh", "en", "ja"); as vozes do
 * sistema costumam ser identificadas por BCP-47 completo ("zh-CN", "en-US"),
 * daí o mapa de regiões padrão e a escolha de voz por prefixo.
 */
const DEFAULT_REGION = {
  zh: "zh-CN",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  pt: "pt-BR",
  ru: "ru-RU",
  ar: "ar-SA",
  hi: "hi-IN",
};

export function isSpeechSupported() {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

/** "zh" -> "zh-CN"; "zh-TW" e outros códigos completos passam intactos. */
export function toBcp47(languageCode) {
  const code = (languageCode || "").trim();
  if (!code) return "";
  if (code.includes("-")) return code;
  return DEFAULT_REGION[code.toLowerCase()] || code;
}

/** Melhor voz instalada para o idioma, ou null se o sistema não tiver nenhuma. */
export function pickVoice(voices, bcp47) {
  if (!bcp47 || !voices || voices.length === 0) return null;
  const target = bcp47.toLowerCase();
  const base = target.split("-")[0];
  return (
    voices.find((v) => (v.lang || "").toLowerCase().replace("_", "-") === target) ||
    voices.find((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(base + "-")) ||
    voices.find((v) => (v.lang || "").toLowerCase() === base) ||
    null
  );
}

/**
 * Fala `text` no idioma indicado. Retorna "spoken", "unsupported" (navegador
 * sem síntese de voz) ou "no-voice" (nenhuma voz instalada para o idioma) —
 * a UI usa isso para avisar em vez de ficar em silêncio sem explicação.
 */
export function speak(text, languageCode) {
  if (!isSpeechSupported()) return "unsupported";
  const clean = (text || "").trim();
  if (!clean) return "unsupported";

  const synth = window.speechSynthesis;
  synth.cancel(); // corta a fala anterior em vez de enfileirar

  const bcp47 = toBcp47(languageCode);
  const utterance = new SpeechSynthesisUtterance(clean);
  if (bcp47) utterance.lang = bcp47;
  utterance.rate = 0.9; // um tico mais devagar ajuda em idioma que se está aprendendo

  const voice = pickVoice(synth.getVoices(), bcp47);
  if (voice) utterance.voice = voice;

  synth.speak(utterance);
  return voice || !bcp47 ? "spoken" : "no-voice";
}
