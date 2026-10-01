/**
 * Peças puras do cliente Anthropic compartilhadas entre o Cognidex
 * (`lib/anthropic.ts`) e o módulo Sinergia (`modules/sinergia/lib/anthropic.ts`).
 * O resto do cliente (chamada HTTP, credenciais, streaming de imagem/thinking)
 * diverge o bastante entre os dois módulos pra não valer a pena forçar numa
 * única implementação parametrizada.
 */
export function looksLikeApiKey(key?: string) {
  return /^sk-ant-[\w-]{10,}$/.test((key || "").trim());
}

export function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Formato inesperado");
  return text.slice(start, end + 1);
}

/* Retry ------------------------------------------------------------------- */

/**
 * Status que valem nova tentativa: timeout, rate limit (429), erros do
 * servidor e "overloaded" (529, comum em horário de pico). Erros de cliente
 * (400/401/403/404) nunca melhoram tentando de novo.
 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);

export function isRetryableStatus(status: number) {
  return RETRYABLE_STATUS.has(status);
}

const MAX_DELAY_MS = 20_000;

/**
 * Espera antes da tentativa `attempt` (0 = primeira repetição). Usa o
 * `retry-after` da API quando vem (segundos), senão backoff exponencial
 * (1s, 2s, 4s…) com jitter de até 30% pra não sincronizar repetições.
 */
export function retryDelayMs(attempt: number, retryAfter?: string | null, rand = Math.random) {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_DELAY_MS);
  const base = 1000 * 2 ** attempt;
  return Math.min(Math.round(base * (1 + 0.3 * rand())), MAX_DELAY_MS);
}

function abortableSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

interface RetryOptions {
  retries?: number;
  signal?: AbortSignal;
  /** Injetável nos testes pra não esperar de verdade. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Executa `doFetch` repetindo em falha de rede ou status transitório (ver
 * `RETRYABLE_STATUS`). Devolve a última `Response` mesmo se não-ok — quem
 * chama continua responsável por transformar o status em mensagem. Abortar
 * (`AbortError`) nunca é repetido.
 */
export async function fetchWithRetry(doFetch: () => Promise<Response>, { retries = 3, signal, sleep }: RetryOptions = {}) {
  const wait = sleep || ((ms: number) => abortableSleep(ms, signal));
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await doFetch();
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || attempt >= retries) throw e;
      await wait(retryDelayMs(attempt));
      continue;
    }
    if (response.ok || !isRetryableStatus(response.status) || attempt >= retries) return response;
    await wait(retryDelayMs(attempt, response.headers.get("retry-after")));
  }
}

/* Prompt caching ---------------------------------------------------------- */

/**
 * Converte o prompt de sistema em bloco com `cache_control`. A API só cacheia
 * prompts acima do mínimo do modelo (~1024 tokens no Sonnet, ~2048 no Haiku);
 * abaixo disso o marcador é ignorado sem erro, então marcar sempre é seguro.
 */
export function cachedSystem(system?: string) {
  if (!system) return undefined;
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}
