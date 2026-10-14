# Funcionalidades

Quando ler: ao mexer em busca, aba Palavras, guias e versões, painel de uso ou Vegedex.
Fonte de verdade para: comportamento das funcionalidades visíveis.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

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

## Painel de Uso da API unificado

`components/UsageSummaryPanel.tsx` mostra Cognidex + Sinergidex numa tabela só (coluna de módulo),
usado em Configurações do Cognidex — a tela de Configurações do Sinergia só mostra um resumo de
uma linha apontando pra lá. O TETO mensal continua configurado e aplicado separadamente por módulo
(arquitetura deliberada, ver "Unificação com o Sinergia" abaixo) — só a VISÃO de gasto foi somada
num lugar, pra não parecer que dois tetos independentes são um só.

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
- `lib/careReminders.ts` (`@capacitor/local-notifications`): `planCareReminders` (puro, testado)
  gera 1 lembrete por tarefa ligada às 9h do dia do vencimento; atrasada vira o próximo 9h. Tarefa
  nunca feita (`lastDoneAt: null`) não avisa. `scheduleCareReminders` (só nativo, debounced 3s)
  roda a cada mudança de `saved` e SUBSTITUI o conjunto todo (cancela pendentes com
  `extra.source === "care"` e reagenda) — sem estado de diff. Permissão só é pedida quando existe
  algo a agendar.
- Não implementado (ficou fora do escopo pedido): medidor de luz em tempo real (precisa de preview
  contínuo de câmera, não só 1 foto) e chat "pergunte ao botânico" (conversa multi-turno — o
  cliente Anthropic do app hoje é só single-shot).
