# Arquitetura

Quando ler: ao mexer em módulos (Cognidex/Sinergidex/Vegedex), estado, lista da Pokédex, cliente Anthropic, exportadores, backup ou pontes entre módulos.
Fonte de verdade para: organização dos módulos, stores, cliente da API e exportação.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

## Unificação com o Sinergia (Sinergidex)

App unificado: o botão redondo no canto superior esquerdo é um toggle real entre três módulos —
**Cognidex** (azul, padrão), **Sinergidex** (amarelo) e **Vegedex** (verde) — via popover. Código
do Sinergia vive em `src/modules/sinergia/` (self-contained: tema, contador de uso e catálogo de
modelos reexportam/derivam das versões do Cognidex em `src/lib/` — ver "Deduplicação" abaixo —, o
resto é cópia própria por ter domínio genuinamente diferente). API key/proxy/orçamento continuam
separados por módulo (`tecnicadex:` vs `efeitosdex:` no storage). Vegedex não é um módulo de dados
separado — é um recorte de tela do próprio Cognidex (já são `kind: "plant"` dentro do `saved`
unificado): trava `searchMode`/`dexCategory` em "plant"/"plants" e reaproveita
`SearchView`/`DexView` como estão. A aba COLEÇÕES aparece tanto no Cognidex quanto no Vegedex
(mesmo `saved`); o Sinergia não tem esse conceito (perfis de efeito são um modelo de dados à
parte).

A navegação do Sinergia (Efeitos/Comparar/Configurações) mora na MESMA barra vermelha do topo
que o Cognidex usa (`components/AppHeader.tsx`) — o módulo não desenha header próprio; ele só
recebe `view`/`onViewChange` como props controladas por `App.tsx`.

`EffectProfileDetail.tsx` (era 1285 linhas) e `DiagnosisPanel.tsx` (era 831) foram quebrados por
seção: `ProfileHeader`/`ItemsTab`/`OthersTab` (mais `ItemSuggestionsRow` à parte) pro primeiro,
`components/diagnosis/*` (um arquivo por sub-modo — causas/caminhos/consequências/prognóstico/
protocolo/indicadores/direção/extrair, mais `shared.tsx`) pro segundo. Cada painel de diagnóstico
tem seu próprio estado de loading/erro/resultado — trocar de sub-modo desmonta o anterior, o que já
limpa esse estado sozinho, sem precisar de `reset()` compartilhado.

### Deduplicação (theme/models/usage/anthropic)

- `src/modules/sinergia/theme.ts` foi removido — o módulo importa direto de `src/theme.ts`
  (eram cópias quase idênticas).
- `src/modules/sinergia/lib/models.ts` reexporta `MODELS`/`PRICING`/`costOf` de
  `src/lib/models.ts`.
- A lógica pura do contador de uso (formato do estado, `recordCall`, custo) mora em
  `src/lib/usageCore.ts`; tanto `src/lib/usage.ts` quanto
  `src/modules/sinergia/lib/usage.ts` importam de lá e só adicionam a camada de persistência
  no próprio namespace.
- `looksLikeApiKey`/`extractJson` (únicas partes realmente idênticas do cliente Anthropic dos
  dois módulos) moram em `src/lib/anthropicShared.ts`. O resto de `lib/anthropic.ts` (chamada
  HTTP, imagens, thinking mode, effort) NÃO foi unificado — os dois módulos divergem o bastante
  (Cognidex manda imagem+effort configurável, Sinergia manda thinking mode fast/auto) pra uma
  função só virar mais confusa que duas.

### Backup único cross-módulo

"Salvar backup deste aparelho" (em Configurações → Importar) gera UM `cognidex-backup.json` com
`saved`/`detailCache`/`collections`/`words` do Cognidex E os perfis de efeito do Sinergia (chave
`sinergia`, mesmo formato de `modules/sinergia/lib/backup.ts`). Importar esse arquivo mescla os
dois automaticamente. Nenhuma API key entra no backup. Antes desta mudança `collections` e
`words` nem entravam no export/import do Cognidex — ficavam pra trás numa restauração.

### Pontes Cognidex ↔ Sinergia

- No card de detalhe de uma técnica/conceito (`views/DetailPage.tsx`), o ícone de link externo
  ao lado de "Voltar" chama `onOpenInSinergia(nome)` — troca pro módulo Sinergia e abre (ou cria)
  um perfil de efeito com o mesmo nome.
- No detalhe de um perfil de efeito (`modules/sinergia/components/EffectProfileDetail.tsx`), o
  botão "Ver no Cognidex" faz o caminho inverso: troca de módulo e busca o mesmo nome como
  conceito.
- A ponte só tenta achar/criar o perfil DEPOIS que `useEffectProfiles` termina de carregar do
  storage (`effects.loaded`) — sem essa checagem, criar/entrar rápido gera perfil duplicado por
  causa da corrida entre o efeito da ponte e o carregamento assíncrono inicial.

Plano original (arquitetura completa "núcleo + cartuchos" com registry/bridge/backup unificado
formais) em
[docs/plano-unificacao-bookdex-sinergia.md](plano-unificacao-bookdex-sinergia.md). O que
existe hoje cobre boa parte das fases 4–6 (orçamentos ainda separados por módulo, mas backup e
pontes card↔perfil já funcionam) de forma pragmática — sem o registry/bridge formais que o plano
original desenhava.

## Estado: DataContext quebrado por domínio

`state/DataContext.tsx` virou só compositor: cada domínio mora num store em `state/data/`
(`savedStore`, `detailsStore`, `wordsStore`, `collectionsStore`, mais `persist.ts`) e o toast em
`state/ToastContext.tsx`. Cada um é publicado num contexto próprio com valor `useMemo` sobre o
próprio estado — hooks estreitos: `useSaved()`, `useDetails()`, `useWords()`, `useCollections()`,
`useToast()`, `useDataMeta()` (counts/applyImport) e `useStorageLoaded()`. `useData()` continua
como fachada que junta tudo (re-renderiza com qualquer mudança) — App/DexView/ImportView usam;
telas novas devem preferir o hook estreito (WordsView e SettingsView já usam). Prefetch de guia
lê `detailCacheRef`/`prefetchRef` e usa `cacheDetail` estável, pra Pokédex não depender do cache de
guias. Carga inicial + migração de schema e `applyImport` ficam no compositor (mexem em vários
domínios de uma vez).

## Pokédex: renderização incremental

`lib/incrementalList.ts`: `DexView` monta 40 itens por vez (`limitEntries` corta entre grupos;
grupos recolhidos não contam) e uma sentinela com IntersectionObserver (`rootMargin` 600px) +
botão "Carregar mais" de fallback libera mais 40. Reinicia ao mudar aba/filtro/tags/ordenação.
Cada card vai num wrapper com `content-visibility: auto`. Escolhido no lugar de react-window porque
os cards têm altura variável e expandem no lugar. Obs.: no Browser pane oculto
(`visibilityState: hidden`) o IntersectionObserver não dispara — testar pelo botão.

## Cliente Anthropic: retry e prompt caching

`lib/anthropicShared.ts` ganhou `fetchWithRetry` (até 3 repetições em 408/429/5xx/529 e falha de
rede, backoff 1s/2s/4s com jitter, respeita `retry-after`, nunca repete `AbortError` nem 4xx de
cliente) e `cachedSystem` (system prompt vira bloco com `cache_control: ephemeral`; abaixo do
mínimo cacheável do modelo a API só ignora). Usados nos DOIS clientes (Cognidex e Sinergia). O
contador de uso (`usageCore.ts`) guarda `cacheWriteTokens`/`cacheReadTokens` só quando > 0 e
`costOf` cobra escrita a 1,25× e leitura a 0,1× do preço de entrada.

## Exportadores unificados e espelho automático em .md

`lib/exportModel.ts` (`sectionsOf`, `techniqueGuide`, `plantAspectEntries`) e `lib/pdfLayout.ts`
(`PdfWriter`, fluxo de parágrafo/heading com quebra de página) são a base compartilhada de
`pdfExport.ts`, `cardPdf.ts` e `ankiExport.ts` — cada um virou só o renderizador do seu formato,
sem reimplementar `sectionsOf`/chave de cache do guia/lista de aspectos de planta.

Não existe mais export manual de Markdown (o botão "Markdown" saiu de Importar → Exportar):
`lib/markdownExport.ts` agora só gera o conteúdo pra um espelho AUTOMÁTICO — `lib/autoMdMirror.ts`
grava `Documentos/Cognidex/cognidex-pokedex.md` sozinho (debounced, 4s de inatividade) sempre que
`saved`/`detailCache` mudam, só em nativo (`Capacitor.isNativePlatform()`; no navegador/PWA não há
pasta de Documentos, então não faz nada). Fica sempre atualizado sem o usuário precisar exportar.
