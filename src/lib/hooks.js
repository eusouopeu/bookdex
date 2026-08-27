import { useEffect, useState } from "react";
import { fetchConceptDeepDive, MissingApiKeyError } from "./anthropic";

/**
 * Percorre `messages` em sequência enquanto `active` for true, avançando a
 * cada `stepMs`. Usado para loadings que podem demorar (chamadas à API),
 * para o usuário não achar que travou.
 */
export function useProgressiveMessage(active, messages, stepMs = 3500) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) {
      setIdx(0);
      return;
    }
    setIdx(0);
    const id = setInterval(() => {
      setIdx((i) => Math.min(i + 1, messages.length - 1));
    }, stepMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepMs]);

  return messages[Math.min(idx, messages.length - 1)];
}

/**
 * Estado do "aprofundar" de um conceito/tipo (DefinitionCard/ListItemCard):
 * busca sob demanda e cacheia em memória só pra sessão atual — igual ao
 * padrão já usado pro guia de técnica, mas sem persistir em storage.
 */
/**
 * Valor que só atualiza `delay`ms depois da última mudança — usado no filtro
 * da Pokédex pra não recalcular o índice de busca a cada tecla digitada.
 */
export function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export function useConceptDeepDive(term, category, summary) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function toggle(e) {
    if (e) e.stopPropagation();
    if (data) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await fetchConceptDeepDive(term, category, summary);
      setData(d);
      setOpen(true);
    } catch (err) {
      setError(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Falhou.");
    } finally {
      setLoading(false);
    }
  }

  return { data, open, loading, error, toggle };
}
