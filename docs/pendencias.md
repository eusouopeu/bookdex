# Pendências

Quando ler: ao retomar o projeto ou propor próximos passos.
Fonte de verdade para: dúvidas, ideias e decisões em aberto.
Atualizado em: 14/10/2026.

Item resolvido sai daqui: decisão vai para [decisoes.md](decisoes.md), ideia
adotada vira tarefa ou entra no código.

## Decisões a tomar

## Dúvidas

## Ideias

- Vegedex: medidor de luz em tempo real (precisa de preview contínuo de câmera) e chat "pergunte ao botânico" (conversa multi-turno; o cliente hoje é single-shot) — ficaram fora do escopo pedido.
- "Regenerar guia com modelo X": não existe seletor de modelo para guias.
- Ligar `noImplicitAny` global (~500 pontos) e zerar `npm run typecheck:lib` (~228 erros).
