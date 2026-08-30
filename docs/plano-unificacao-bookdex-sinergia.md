# Plano: unificação Bookdex + Sinergia (Efeitosdex)

Status: **planejado, não iniciado**. Implementar quando solicitado.

## Diagnóstico

Sinergia é um fork da Bookdex: `theme.js` idêntico, casca do aparelho igual,
`storage.js`/`usage.js`/`anthropic.js`/`models.js` são a mesma coisa com
pequenas divergências. Não é integração de dois apps estranhos — é reverter
um fork e transformar a divergência em módulo.

## Arquitetura: núcleo + cartuchos

```
src/
  core/                     casca, tema, storage, anthropic, models, usage, backup, UI base
  modules/
    bookdex/                DataContext, PrefsContext, views, lib (savedModel, plants, words…)
    sinergia/               useEffectProfiles, EffectProfileDetail, lib (effectProfiles, checkins…)
  bridge/                   único ponto de contato entre os dois módulos
  registry.js               lista de módulos que o shell monta
```

**Vira `core/` (fusão real, ~1.200 linhas → ~700):** `theme.js` (idêntico),
casca vermelha do App.jsx, `storage.js` (versão Bookdex, Capacitor
Preferences — Sinergia ganha persistência nativa de graça), `anthropic.js`
(superset da Bookdex + `thinkingMode` da Sinergia), `models.js`, `usage.js`,
`NoteEditor`, `Skeleton`, `CardShell`, `utilities.css`.

Ganho imediato antes de qualquer feature nova: uma chave de API, um teto
mensal, um contador de gasto, um tema, um backup, um APK. Hoje o teto de
US$ da Bookdex não sabe do gasto da Sinergia — o limite mensal não funciona
de fato com dois apps separados.

## As três garantias de independência

1. **Namespace de storage por módulo.** `dex:*` e `efx:*` sobre o mesmo
   backend. Cada módulo mantém sua própria cadeia de migração e seu próprio
   `schemaVersion` (`migrations.js` da Bookdex e `migrate.js` da Sinergia
   continuam separados, intocados). Corromper um esquema não atinge o outro.

2. **Registry.** Cada módulo exporta
   `{ id, label, icon, tabs, routes, settingsPanel, migrations, backupSlice, searchIndex }`.
   O shell não conhece nenhum dos dois por nome — itera o registry. Remover
   um módulo = tirar uma linha; o app continua bootando. Teste de
   independência: apagar `modules/sinergia/` e a Bookdex tem que compilar.

3. **Nenhum import cruzado.** `modules/bookdex/**` não importa
   `modules/sinergia/**` e vice-versa. Só `bridge/` importa os dois, sempre
   por **ref frouxa**: `{ module, kind, id }` que resolve pra `null` quando
   o alvo sumiu — o mesmo padrão de "referência órfã" que `collections.js`
   já usa hoje. Zero chave estrangeira, zero dado duplicado.

## O cruzamento (o que a fusão destrava)

| Ponte | O que faz |
|---|---|
| **Card → item de perfil** | Adicionar item ao perfil de efeito escolhendo de cards já salvos na Pokédex. O item guarda `source: {module:'bookdex', subjectKey, itemId}` |
| **Contexto na avaliação** | Avaliação por IA de item importado recebe a `description`/guia já capturado como contexto — estimativa melhor, prompt mais curto |
| **`statLabels` → critérios** | As 4 categorias de comparação de uma busca de técnicas viram critérios de um perfil (`1..5` mapeado pra `-5..+5`, ou só como sugestão de nomes) |
| **Coleção ⇄ perfil** | Coleção da Bookdex (já cruza assuntos) vira perfil de efeito com todos os itens como candidatos, e o inverso |
| **"Aparece em N perfis"** | No `DetailPage` de um card, seção mostrando as notas atuais dele nos perfis que o referenciam |
| **Busca unificada** | Busca da Bookdex passa a achar perfis, itens e critérios da Sinergia por índice local — custo zero de API |
| **Backup único** | Um arquivo com uma seção por módulo; importador aceita backup antigo de qualquer um dos dois apps |

O dado nunca é copiado: item de perfil só carrega a `source` ref, o card
continua vivendo em `saved`. Apagar o card não quebra o perfil — o item vira
"sem origem" e mantém as notas.

## Repositório e appId

**Hospedar na `bookDex`**, trazendo a Sinergia pra dentro: já tem vitest
configurado (Sinergia tem zero testes), `@capacitor/preferences` +
`filesystem`, proxy Cloudflare, `migrations.js` maduro, e é o volume maior
(6.2k linhas vs 3.2k linhas).

**Manter `applicationId com.pedroteles.tecnicadex`** — preserva os dados da
Bookdex já instalada num update normal. Dados da Sinergia migram uma vez via
`backup.js` que ela já tem: exporta do APK atual, importa no unificado.
Trocar o appId forçaria reimportar os dois do zero.

Nome do produto: marca guarda-chuva com as duas abas dentro (a casca do
aparelho já é visualmente o mesmo dispositivo — dois cartuchos).

## Fases de implementação

1. **Extrair `core/`** dentro da própria Bookdex, sem mudar comportamento.
   Testes existentes têm que passar iguais.
2. **Criar o registry** e mover as views da Bookdex pra `modules/bookdex/`,
   consumidas via registry.
3. **Portar a Sinergia** como `modules/sinergia/` — reescrita de imports,
   namespace `efx:` no storage, migração das chaves `efeitosdex:*`.
4. **Consolidar Configurações** (chave, proxy, tema, teto, uso, cache) numa
   tela só, com um painel por módulo abaixo.
5. **Bridge**: refs, resolvers, pontes na ordem card→item, contexto na
   avaliação, "aparece em N perfis". Resto depois.
6. **Backup unificado** com leitura dos dois formatos legados.

Fases 1–3 são majoritariamente mecânicas (mover arquivo, reescrever import).
O pensamento real está nas fases 4 e 5.

## Pontos de atenção

- Colisão de nome: os dois têm `views/CompareView.jsx` e são coisas
  completamente diferentes — Bookdex compara técnicas lado a lado, Sinergia
  compara itens por critério. Renomear ao mover para os módulos.
- `usage.js` da Bookdex já suporta multi-modelo (`byModel`) com migração de
  formato legado plano — o `usage.js` da Sinergia (mono-modelo) deve ler
  esse formato ao fundir, não o contrário.
