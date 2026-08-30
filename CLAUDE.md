# Bookdex

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

- Sempre usar **TypeScript**, **Tailwind CSS**, ícones **Lucide** e fonte **Montserrat** com
  espaçamento entrelinhas (line-height) de 1.5.
- Dar preferência a **botões-ícone** em vez de botões com texto.
- Projeto migrado para TypeScript (arquivos `.ts`/`.tsx`, `tsconfig.json` na raiz com
  `strict: false`). Novos arquivos devem ser criados como `.ts`/`.tsx` com tipos explícitos
  (interfaces de props, tipos de domínio em vez de `unknown`/`any` quando viável). Rodar
  `npx tsc --noEmit` antes de considerar uma mudança concluída.

## Testes

- Por rodada de alterações, realizar apenas os **2 ou 3 testes mais essenciais** — não mais que isso.
- Esses testes devem ser **elaborados ANTES** da implementação das mudanças de código, para que não
  sejam enviesados pelo resultado da implementação.


## Commit, push e atualização do CLAUDE.md

- A cada rodada em que o código do app/site for alterado, deve ser feito o **commit** e o **push**
  para o repositório remoto no GitHub.
- Nessa mesma rodada, atualizar o conteúdo deste **CLAUDE.md** no que couber (novas convenções,
  decisões, mudanças de stack, etc.), mantendo-o coerente com o estado atual do projeto.

## Proibição de leitura de dependências

- NUNCA ler arquivos de dependências (ex.: `node_modules/`, `dist/`, `build/`, pastas de vendor
  ou qualquer artefato gerado/instalado) para obter contexto. Usar apenas o código-fonte do
  próprio projeto.

## Unificação com a Sinergia (Efeitosdex)

Existe um plano de reunificação da Bookdex com o app Sinergia (`../sinergia`), que é
originalmente um fork desta. Plano detalhado, ainda não implementado, em
[docs/plano-unificacao-bookdex-sinergia.md](docs/plano-unificacao-bookdex-sinergia.md).
Consultar esse arquivo antes de iniciar qualquer trabalho de unificação.

