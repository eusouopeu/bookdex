# Estilo (Tailwind) e TypeScript

Quando ler: ao escrever JSX/CSS novo, migrar estilo inline ou mexer em tipos/tsconfig.
Fonte de verdade para: Tailwind sem preflight, tokens `@theme inline`, `@utility`, estado da migração de estilo e dívida de tipos.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

## TypeScript

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

## Tailwind e débito de estilo

Tailwind v4 instalado de verdade (`tailwindcss` + `@tailwindcss/vite`, entrada em
`src/tailwind.css`) — antes só existia o subconjunto caseiro `utilities.css`. Importado SEM
preflight (só `theme.css` + `utilities.css` do Tailwind), pra não mexer em margens/botões das
telas ainda inline. Pegadinhas:
- Regra CSS fora de `@layer` vence QUALQUER classe do Tailwind (que mora em `@layer utilities`).
  Por isso o `button, input, textarea { font: inherit }` saiu de `utilities.css` e foi pra
  `@layer base` em `tailwind.css` — senão `font-display`/`text-[..]` em botão não pegam.
- Tokens do app em `@theme inline` (`bg-shell-red-dark`, `text-cream`, `bg-gold`, `text-ink`,
  `border-screen-border`, `bg-surface`, `text-muted`, `font-display`/`font-body`/`font-mono`).
  Com `inline` as variáveis `--color-*` NÃO existem em runtime — dentro de `@utility` use valor
  literal ou as vars do app (`--ink`, `--surface`…).
- Componentes recorrentes como `@utility`: `dex-tab` (aba da barra vermelha, = `tabStyle()`),
  `mode-pill` (pílula de modo de busca), `shell-icon-btn` (= `iconButtonStyle`). Estado ativo via
  `aria-pressed="true"`, não classe condicional.

Já migrados: `AppHeader.tsx`, `BottomBar.tsx`, `DexCategoryNav.tsx`. O resto (inclusive
`src/modules/sinergia/`) ainda é `style={{...}}` inline — ao tocar num arquivo por outro motivo,
não é obrigatório migrar de brinde, mas JSX novo deve ser Tailwind. Gradientes/cores que dependem
de dado em runtime (ex.: cor do módulo na lente) continuam em `style`.
