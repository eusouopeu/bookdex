import { useEffect, useState } from "react";

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
