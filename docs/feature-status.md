# Estado de funcionalidades

Quando ler: antes de criar, remover ou recriar funcionalidade.
Fonte de verdade para: o que foi removido e não deve voltar; contratos visíveis.
Atualizado em: 14/10/2026.

## Não reimplementar

Funcionalidade removida ou substituída, com data e o que cobre o uso agora.

- Export manual de Markdown (botão "Markdown" em Importar → Exportar): substituído pelo espelho automático `Documentos/Cognidex/cognidex-pokedex.md`.
- Campo de busca próprio da aba Palavras: removido de propósito; a aba usa a mesma caixa de busca da Pokédex (`wordSearchIndex`).
- Descartar o guia anterior ao regenerar: agora vai para `detailHistory` (até 5 versões).
- `src/modules/sinergia/theme.ts`: removido; o módulo importa de `src/theme.ts`.

## Contratos visuais e funcionais

Comportamentos visíveis que parecem estranhos mas são intencionais.
