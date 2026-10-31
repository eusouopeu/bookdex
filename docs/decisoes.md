# Decisões

Quando ler: antes de mudar comportamento já decidido.
Fonte de verdade para: o que já foi decidido no projeto (uma linha por decisão).
Atualizado em: 31/10/2026.

Decisão nova entra no topo, com data e onde está detalhada. Decisão ainda em
aberto fica em [pendencias.md](pendencias.md).

| Data | Decisão | Detalhe em |
|---|---|---|
| 31/10/2026 | `local-notifications` registrado no projeto Android (cap sync) para os lembretes de plantas | `android/capacitor.settings.gradle` |
| 14/10/2026 | Documentação segue `../_shared/docs-standards.md` | `CLAUDE.md` |
| 01/10/2026 | Cliente Anthropic com retry (backoff e jitter em 408/429/5xx/529, respeitando `retry-after`) e prompt caching; custo conta tokens de cache | `docs/arquitetura.md` |
| 01/10/2026 | `DataContext` dividido em stores por domínio, com `useData()` como fachada | `docs/arquitetura.md` |
| 01/10/2026 | Tailwind v4 sem preflight, migrando componente por componente | `docs/estilo-e-tipos.md` |
| 31/08/2026 | Bookdex, Sinergia e Plantas viram três módulos (Cognidex, Sinergidex, Vegedex) atrás do botão do topo; Sinergia persiste em Capacitor Preferences com prefixo `efeitosdex:` | `docs/plano-unificacao-bookdex-sinergia.md` |
| 29/08/2026 | App migrado para TypeScript | `docs/arquitetura.md` |
| 22/08/2026 | Modelo por tarefa (Sonnet para raciocínio, Haiku para consulta estruturada), cache de busca por 30 dias e teto mensal de gasto | `docs/funcionalidades.md` |
| 22/08/2026 | Aprofundar genérico vira aspectos sob demanda por tipo de card | `docs/funcionalidades.md` |
| 20/08/2026 | Sem revisão espaçada no app: memorização só pelo export para o Anki | `docs/funcionalidades.md` |
| 20/08/2026 | Schema persistido versionado, com migrações na abertura e na importação | `docs/arquitetura.md` |
| 19/08/2026 | Etimologia desligada para mandarim; componentes semântico e fonético identificados sob demanda | `docs/funcionalidades.md` |
