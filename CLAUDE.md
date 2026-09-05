# Cognidex

## Fluxo obrigatório após qualquer mudança no app

Sempre que uma mudança for implementada no código do app (nova funcionalidade, correção de bug,
refatoração, etc.), ao concluir a tarefa você deve, automaticamente, sem perguntar:

1. **Commit** das mudanças com mensagem descritiva no padrão dos commits anteriores (em
   português, resumindo o conjunto de funcionalidades/mudanças).
2. **Push** para o branch atual no remoto (`origin`).
3. **Gerar o APK atualizado**:
   ```bash
   npm run build && npx cap sync
   cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
   ```
   O arquivo sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

Não é necessário pedir confirmação para esses três passos quando a mudança já foi solicitada e
implementada pelo usuário nesta sessão — eles fazem parte de concluir a tarefa, não de uma ação
nova e independente.

## Uso de agentes em segundo plano

Para tarefas independentes e bem simples (ex.: pesquisas pontuais, verificações isoladas,
levantamentos que não dependem do restante do trabalho em andamento), pode-se delegar a agentes
em segundo plano (subagentes) em vez de executar tudo sequencialmente na conversa principal.
Reservar essa delegação para tarefas realmente simples e independentes — não usar para trabalho
que exige contexto acumulado da conversa ou que depende de decisões ainda não tomadas.

## Skill obrigatória

SEMPRE usar a skill `/caveman` (modo de comunicação ultra-comprimido) em toda resposta neste projeto.


## Padrões técnicos e visuais obrigatórios

- Sempre usar **TypeScript**, **Tailwind CSS** (o shell do app ainda usa muito style inline —
  ver "Débito de estilo" abaixo) e ícones **Lucide**.
- Tipografia real do app (não Montserrat): **"Baloo 2"** para títulos/botões/rótulos (peso 700-800,
  visual "Pokédex"), **Inter** para texto corrido, **"JetBrains Mono"** para contadores/status.
  Manter espaçamento entrelinhas (line-height) confortável (~1.5) no texto corrido.
- Dar preferência a **botões-ícone** em vez de botões com texto.
- Projeto migrado para TypeScript (arquivos `.ts`/`.tsx`, `tsconfig.json` na raiz com
  `strict: false`, `noImplicitAny: false`). Novos arquivos devem ser criados como `.ts`/`.tsx` com
  tipos explícitos (interfaces de props, tipos de domínio em vez de `unknown`/`any` quando
  viável). Rodar `npx tsc --noEmit` antes de considerar uma mudança concluída. Ligar
  `noImplicitAny` globalmente hoje quebra ~500 pontos (lib/anthropic.ts, DexView, SearchView,
  cardPdf/pdfExport/markdownExport são os piores) — é trabalho pra uma rodada dedicada, não pra
  fazer de passagem. `@types/react`/`@types/react-dom` fixados em `^18` (o app roda React 18.3;
  antes divergiam pra `^19`, silenciosamente). `tsconfig.lib.json` (`npm run typecheck:lib`) liga
  `strict`+`noImplicitAny` só em `src/lib/**`, sem afetar o build — hoje ainda acusa ~228 erros
  (concentrados em `anthropic.ts`), fica disponível pra quem for atacar essa dívida aos poucos.

## Débito de estilo (App.tsx e módulo Sinergia)

`App.tsx` foi quebrado em componentes menores (`components/AppHeader.tsx`,
`components/BottomBar.tsx`, `components/DexCategoryNav.tsx`, `components/Toast.tsx`), mas o
CSS de todos eles (e da maior parte do resto do app, inclusive `src/modules/sinergia/`) ainda é
`style={{...}}` inline, não Tailwind. Migrar pra Tailwind é trabalho de v2 — ao tocar num desses
arquivos por outro motivo, não é obrigatório migrar de brinde, mas prefira Tailwind em qualquer
JSX novo.

## Testes

- Por rodada de alterações, realizar apenas os **2 ou 3 testes mais essenciais** — não mais que isso.
- Esses testes devem ser **elaborados ANTES** da implementação das mudanças de código, para que não
  sejam enviesados pelo resultado da implementação.


## Commit, push e atualização do CLAUDE.md

- A cada rodada em que o código do app/site for alterado, deve ser feito o **commit** e o **push**
  para o repositório remoto no GitHub.
- Nessa mesma rodada, atualizar o conteúdo deste **CLAUDE.md** no que couber (novas convenções,
  decisões, mudanças de stack, etc.), mantendo-o coerente com o estado atual do projeto.

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

## Painel de Uso da API unificado

`components/UsageSummaryPanel.tsx` mostra Cognidex + Sinergidex numa tabela só (coluna de módulo),
usado em Configurações do Cognidex — a tela de Configurações do Sinergia só mostra um resumo de
uma linha apontando pra lá. O TETO mensal continua configurado e aplicado separadamente por módulo
(arquitetura deliberada, ver "Unificação com o Sinergia" abaixo) — só a VISÃO de gasto foi somada
num lugar, pra não parecer que dois tetos independentes são um só.

## Busca: cancelar e Palavras pesquisável

- A busca (`App.tsx` → `handleSearch`) agora usa `AbortController`: o botão ESCANEAR vira CANCELAR
  durante o carregamento e aborta a requisição HTTP de verdade (não só ignora a resposta). Os
  `fetch*` de busca em `lib/anthropic.ts` (técnica/conceito/tipo/comparar/palavra/planta) aceitam
  um `signal` opcional pra isso.
- A aba Palavras não tinha NENHUMA busca (o campo antigo foi removido de propósito, ver comentário
  em `WordsView.tsx`, pra não ter dois modelos mentais de busca). Em vez de reintroduzir um campo
  próprio, `DexView.tsx` ganhou um índice full-text (`wordSearchIndex`, cobrindo palavra/
  significado/pinyin/radical/caracteres/nota/tags) e mostra a MESMA caixa de busca da Pokédex
  quando a categoria é "words", filtrando antes de passar pra `WordsView` (que aceita `words` como
  prop opcional pra isso, com fallback pro contexto).

## Versões de guia

Regenerar um guia (botão de lixeira em `DetailPage.tsx`) não descarta mais o guia anterior: ele vai
pro `detailHistory` (`DataContext.tsx`, storage próprio `pokedex-detail-history`, até 5 versões por
guia, mais antiga cai fora). O ícone de histórico ao lado mostra quantas versões existem, com
"Comparar" (mostra a versão antiga abaixo, empilhado — não lado a lado, a tela é estreita demais
pra isso) e "Restaurar" (a versão restaurada assume, a que estava ativa vai pro arquivo no lugar
dela). Assume o modelo fixo de guia (`MODELS.sonnet`) pra cada versão arquivada — não existe
seletor de modelo pra guias hoje (diferente dos modos de busca), então não tem "regenerar com
modelo X" ainda.

## Vegedex: aspecto de pets, filtro multi-tag, calculadora, diagnóstico e cronograma

- `PLANT_ASPECTS` (lib/anthropic.ts) ganhou um 5º aspecto, `petSafety` ("Segurança para
  pets") — mesmo mecanismo de sempre (botão-ícone, chamada curta sob demanda), sem infra nova.
- Filtro de tag da Pokédex (`DexFilterBar`/`DexView`) virou multi-seleção: `activeTags: string[]`
  em vez de `activeTag: string|null`, com semântica E (item precisa ter TODAS as tags marcadas).
  Vale pra Vegedex e Cognidex igual, é o mesmo componente.
- `lib/waterCalculator.ts`: calculadora de água pura (sem API) — vaso tratado como cilindro
  (altura ≈ 0.85× diâmetro), com fração de volume por tipo de planta e multiplicador por estação.
  UI em `components/WaterCalculatorPanel.tsx`, no card de planta.
- `fetchPlantDiagnosis` (lib/anthropic.ts, tier fixo `plantDiagnosis`→Sonnet): diagnóstico de
  doença/praga a partir de 1 foto — retorna causas prováveis e tratamento em texto, SEM anotação
  de região tocável na imagem (isso é visão computacional local, não o que um LLM de texto faz).
  UI em `components/PlantDiagnosisPanel.tsx`.
- `lib/plants.ts`: `CareSchedule`/`CareTaskState`/`daysUntilDue` — cronograma de água/fertilização
  por planta salva, dado 100% local (intervalo configurável + data da última vez), sem chamada de
  API nem migração de schema (campo `care` é opcional, planta sem cronograma configurado
  simplesmente não computa nada diferente). `updateItemCareTask` no `DataContext`, UI em
  `components/CareSchedulePanel.tsx` (só aparece em planta já salva, com botão "Feito hoje").
- Não implementado (ficou fora do escopo pedido): medidor de luz em tempo real (precisa de preview
  contínuo de câmera, não só 1 foto), lembretes/notificações push (exigiria
  `@capacitor/local-notifications`, dependência nova) e chat "pergunte ao botânico" (conversa
  multi-turno — o cliente Anthropic do app hoje é só single-shot).

## Proibição de leitura de dependências

- NUNCA ler arquivos de dependências (ex.: `node_modules/`, `dist/`, `build/`, pastas de vendor
  ou qualquer artefato gerado/instalado) para obter contexto. Usar apenas o código-fonte do
  próprio projeto.

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
[docs/plano-unificacao-bookdex-sinergia.md](docs/plano-unificacao-bookdex-sinergia.md). O que
existe hoje cobre boa parte das fases 4–6 (orçamentos ainda separados por módulo, mas backup e
pontes card↔perfil já funcionam) de forma pragmática — sem o registry/bridge formais que o plano
original desenhava.

