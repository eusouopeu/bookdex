import { useEffect, useRef, useState } from "react";

/**
 * Renderização incremental da Pokédex: em vez de montar centenas de cards de
 * uma vez, monta os primeiros `PAGE_SIZE` itens e vai liberando mais conforme
 * o usuário chega perto do fim da lista (sentinela + IntersectionObserver).
 *
 * Escolhido no lugar de virtualização "de verdade" (react-window) porque os
 * cards têm altura variável e se expandem no lugar (aspectos, nota, fotos,
 * cronograma) — janela fixa ficaria pulando. Somado ao `content-visibility:
 * auto` em cada card (ver DexView), o navegador também pula layout/pintura
 * do que já foi montado mas está fora da tela.
 */
export const PAGE_SIZE = 40;

type Entry<G> = [string, G];

/**
 * Corta a lista de grupos pra caber em `maxItems` itens ABERTOS. Grupos
 * recolhidos custam só o cabeçalho, então não contam pro limite. O grupo que
 * estoura o limite entra parcialmente (só os primeiros itens).
 */
export function limitEntries<G extends { items?: unknown[] }, I = NonNullable<G["items"]>[number]>(
  entries: Entry<G>[],
  maxItems: number,
  isCollapsed: (key: string) => boolean,
  withItems: (group: G, items: I[]) => G
): { entries: Entry<G>[]; hasMore: boolean } {
  const out: Entry<G>[] = [];
  let budget = maxItems;
  for (const [key, group] of entries) {
    if (isCollapsed(key)) {
      out.push([key, group]);
      continue;
    }
    if (budget <= 0) return { entries: out, hasMore: true };
    const items = (group.items || []) as I[];
    if (items.length <= budget) {
      out.push([key, group]);
      budget -= items.length;
    } else {
      out.push([key, withItems(group, items.slice(0, budget))]);
      return { entries: out, hasMore: true };
    }
  }
  return { entries: out, hasMore: false };
}

/**
 * Limite crescente + ref da sentinela. `resetKey` muda quando o filtro/aba
 * muda — aí volta pra primeira página (a lista nova não tem relação com o
 * quanto o usuário rolou na anterior).
 */
export function useIncrementalLimit(resetKey: string) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setLimit(PAGE_SIZE), [resetKey]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (obs) => {
        if (obs.some((o) => o.isIntersecting)) setLimit((l) => l + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });

  return { limit, sentinelRef, showMore: () => setLimit((l) => l + PAGE_SIZE) };
}
