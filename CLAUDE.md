# Cognidex — instruções permanentes

App unificado (Android via Capacitor + PWA) com três módulos no mesmo shell:
**Cognidex** (técnicas, conceitos, palavras — azul, padrão), **Sinergidex**
(perfis de efeito — amarelo, `src/modules/sinergia/`) e **Vegedex** (plantas —
verde, recorte de tela do Cognidex). Usa a API da Anthropic com a chave do
usuário.

Leia somente os documentos pertinentes à tarefa; não carregue documentação ou
arquivos grandes por padrão.

## Padrões compartilhados

Segue `../_shared/tech-standards.md` (stack, testes, commit/push/release,
`/caveman`, subagentes, dependências), `../_shared/design-standards.md`,
`../_shared/minimalismo.md` e `../_shared/docs-standards.md`.
Exceções deste projeto:

- Ícones **Lucide**, não Heroicons.
- Tipografia própria (não Montserrat): **"Baloo 2"** em títulos/botões/rótulos
  (700–800, visual "Pokédex"), **Inter** no texto corrido (line-height ~1.5),
  **"JetBrains Mono"** em contadores/status.
- Preferir botões-ícone a botões com texto.
- Shell ainda tem muito `style={{...}}` inline; JSX novo é Tailwind (ver
  `docs/estilo-e-tipos.md`).

## Regras invioláveis

- Arquivo novo em `.ts`/`.tsx` com tipos explícitos; rodar `npx tsc --noEmit`
  antes de dar a mudança por concluída. Ligar `noImplicitAny` global é rodada
  dedicada, não de passagem.
- CSS fora de `@layer` vence qualquer utility do Tailwind; regra nova vai em
  `@layer base`/`components`. Com `@theme inline`, as `--color-*` não existem
  em runtime — dentro de `@utility` use valor literal ou as vars do app.
- Tela nova usa o hook estreito (`useSaved`, `useDetails`, `useWords`,
  `useCollections`, `useToast`), não a fachada `useData()`.
- Exportadores (`pdfExport`, `cardPdf`, `ankiExport`) usam a base
  `lib/exportModel.ts` + `lib/pdfLayout.ts`; não reimplementar `sectionsOf`.
- Chamada nova à API passa por `fetchWithRetry`/`cachedSystem`
  (`lib/anthropicShared.ts`) e aceita `signal` para cancelar.

## Contratos sensíveis

- API key, proxy e orçamento **separados por módulo** (`tecnicadex:` ×
  `efeitosdex:`); só a visão de gasto é somada. Nenhuma API key entra no
  backup.
- Backup único `cognidex-backup.json` leva Cognidex e Sinergia (chave
  `sinergia`); importar mescla os dois.
- Ponte Cognidex ↔ Sinergia só cria/acha perfil depois de `effects.loaded`
  (senão duplica perfil).
- Filtro de tags é multisseleção com semântica E (`activeTags`).
- Espelho `.md` automático (`lib/autoMdMirror.ts`) só roda em nativo.

## Fluxo de trabalho

- Faça a menor alteração completa; não faça refactor não relacionado.
- Antes de propor melhorias ou recriar algo, consulte
  `docs/feature-status.md` ("Não reimplementar") e `docs/aprimoramentos.md`
  ("Recomendações refutadas").
- Build do APK (o restante segue o fluxo global):
  ```bash
  npm run build && npx cap sync
  cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
  ```
  Saída: `android/app/build/outputs/apk/debug/app-debug.apk`. Push para o
  branch atual em `origin`.

## Fim de sessão

Antes do commit, atualizar: `docs/decisoes.md` (decisão nova no topo),
`docs/pendencias.md`, `docs/feature-status.md` se uma funcionalidade visível
mudou, `docs/aprimoramentos.md` se uma melhoria foi entregue ou recusada e o
documento temático tocado (`arquitetura`, `funcionalidades`,
`estilo-e-tipos`).

## Atualização desta documentação

- `CLAUDE.md` só muda quando uma regra global do projeto muda (substitui a
  antiga regra de atualizá-lo a cada rodada, 14/10/2026).
- Detalhe de módulo, tela ou funcionalidade vai para o `docs/<tema>.md`.

## Navegação

| Arquivo | Quando ler |
|---|---|
| `docs/arquitetura.md` | Módulos, estado, lista da Pokédex, cliente Anthropic, exportadores, backup, pontes |
| `docs/funcionalidades.md` | Busca, Palavras, versões de guia, painel de uso, Vegedex |
| `docs/estilo-e-tipos.md` | JSX/CSS novo, migração de estilo inline, tsconfig e dívida de tipos |
| `docs/plano-unificacao-bookdex-sinergia.md` | Plano original "núcleo + cartuchos" |
| `docs/decisoes.md` | Antes de mudar comportamento já decidido |
| `docs/pendencias.md` | Ao retomar o projeto ou propor próximos passos |
| `docs/feature-status.md` | Antes de criar ou remover funcionalidade |
| `docs/aprimoramentos.md` | Antes de sugerir melhorias |
