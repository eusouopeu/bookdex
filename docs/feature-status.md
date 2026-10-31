# Estado de funcionalidades

Quando ler: antes de criar, remover ou recriar funcionalidade.
Fonte de verdade para: o que foi removido e não deve voltar; contratos visíveis.
Atualizado em: 31/10/2026.

## Não reimplementar

Funcionalidade removida ou substituída, com data e o que cobre o uso agora.

- Revisão espaçada no app (ReviewView, widget Android, lembretes e ordenação por próxima revisão) – removida em 20/08/2026; o export para o Anki cobre o uso.
- "Sugestões para você" e vínculo manual entre cards – removidos em 20/08/2026.
- Botão único de aprofundar em técnica e conceito – substituído em 22/08/2026 pelos aspectos sob demanda.
- Componentes do hanzi gerados automaticamente na busca – substituídos em 19/08/2026 pelo botão por caractere.

- Export manual de Markdown (botão "Markdown" em Importar → Exportar): substituído pelo espelho automático `Documentos/Cognidex/cognidex-pokedex.md`.
- Campo de busca próprio da aba Palavras: removido de propósito; a aba usa a mesma caixa de busca da Pokédex (`wordSearchIndex`).
- Descartar o guia anterior ao regenerar: agora vai para `detailHistory` (até 5 versões).
- `src/modules/sinergia/theme.ts`: removido; o módulo importa de `src/theme.ts`.

## Contratos visuais e funcionais

Comportamentos visíveis que parecem estranhos mas são intencionais.

- Converter um card para outro tipo descarta os aspectos do tipo anterior.
- Pokédex renderiza 40 itens por vez ("Carregar mais").
