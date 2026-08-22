# Bookdex

App standalone (Android via Capacitor + PWA) da Bookdex — escaneie um assunto,
compare 6 técnicas lado a lado, identifique uma planta pela foto, capture o que
interessa e abra o guia passo a passo.

Porte fiel do artefato React que roda no claude.ai, com duas diferenças obrigatórias:
fora daquele sandbox não existe `window.storage` nem proxy autenticado para a API da
Anthropic. Aqui a persistência é `@capacitor/preferences` e a chamada à API usa a
**sua própria chave**, configurada dentro do app.

---

## 1. Rodar como web/PWA

```bash
npm install
```

```bash
npm run dev
```

Build de produção + preview local:

```bash
npm run build && npm run preview
```

O `vite-plugin-pwa` gera `manifest.webmanifest` e um service worker que faz precache
de HTML, JS, CSS, ícones e fontes. Resultado prático: com o app já aberto uma vez, a
tela e **as técnicas e guias já salvos** continuam funcionando offline. Gerar técnicas
novas ou guias novos sempre exige internet — isso é chamada de API.

As fontes (Baloo 2, JetBrains Mono, Inter) estão embutidas em `public/fonts/`, então o
visual não depende de acesso ao Google Fonts.

## 2. Configurar a API key

1. Crie uma chave em <https://console.anthropic.com> → **API Keys** (formato `sk-ant-...`).
2. No app, toque na engrenagem (canto superior direito) → cole a chave → **Salvar**.

A chave fica só no aparelho, via `@capacitor/preferences` (Android: `SharedPreferences`;
navegador: `localStorage`). Nada é hardcodado no código-fonte e nada é enviado para
terceiros — as requisições vão direto para `https://api.anthropic.com/v1/messages` com
os headers `x-api-key`, `anthropic-version: 2023-06-01` e
`anthropic-dangerous-direct-browser-access: true` (este último é o que libera CORS para
chamadas feitas de browser/WebView).

Sem chave configurada, as telas **Buscar** e **Aprofundar** mostram um aviso com atalho
para Configurações — o resto do app (Pokédex salva, guias em cache, importação)
continua funcionando normalmente.

> Custo: cada busca gasta ~1k tokens de saída e cada guia ~1,2k. O modelo varia por
> tarefa (ver §6, "Modelos e custo") e a cobrança cai na sua conta da Anthropic.
> Configurações mostra o gasto estimado por modelo e aceita um **teto mensal** em
> dólares que trava as chamadas quando é atingido.

### Plano B: proxy (só se der CORS)

A chamada direta é a implementação padrão e deve funcionar tanto no APK quanto no PWA.
Se em algum ambiente ela for bloqueada por CORS, use o Worker de exemplo em
[proxy/cloudflare-worker.js](proxy/cloudflare-worker.js): ele só repassa a requisição e
injeta a chave guardada no servidor. Depois de publicar, cole a URL em
**Configurações → Proxy**; o app passa a usar esse endereço em vez da API direta.

## 3. Modos de busca

Toda busca sai da mesma barra, e o prefixo (ou o botão de modo) escolhe o prompt e o
formato do card:

| Prefixo | Modo | O que retorna |
| --- | --- | --- |
| `tec: assunto` (ou sem prefixo) | Técnicas | 6 técnicas comparadas com barras de stats (comportamento original) |
| `def: termo` | Conceito | Um verbete único: definição, pontos-chave, exemplo e termos relacionados |
| `list: assunto` | Tipos | De 5 a 10 itens enumerando tipos/categorias do assunto |
| `cmp: a, b, c` | Comparar | Comparação direta entre 2 e 3 itens nomeados por você |
| `pal: palavra` | Palavra | Verbete de dicionário: idioma, significado, radical (ou pinyin + hanzi) |
| `plt: planta` | Planta | Ficha botânica: nome científico, nomes populares e resumo |

No modo **Planta** a barra ganha um botão de câmera: a foto vale como busca, e a
identificação vem da própria imagem (ver §6, "Plantas").

As três abas do topo são **Buscar**, **Pokédex** e **Coleções**. Dentro da Pokédex, a
barra de baixo alterna entre **Técnicas**, **Conceitos**, **Plantas** e **Palavras** —
todas só acervo, porque buscar é sempre na aba Buscar. Importação e exportação cobrem
todos os modos.

### Cache de buscas

Repetir uma busca já feita — mesmo modo, termo, critérios, esforço e modelo — devolve o
resultado guardado, sem gastar chamada. As entradas valem 30 dias, e todo resultado que
vem do cache aparece com o aviso e o atalho **Refazer busca**, que força a rede. Uma
palavra que você já capturou nem chega a consultar o cache: o verbete salvo é a resposta.
Configurações mostra quantas buscas estão guardadas e permite limpar tudo.

### Compartilhar de outro app (Android)

O Bookdex é alvo de compartilhamento de texto: selecione um termo em qualquer app,
**Compartilhar → Bookdex**, e ele abre já buscando esse termo (como conceito, salvo se
o texto vier com um prefixo explícito).

## 4. Gerar o APK

Pré-requisitos: **JDK 21** (o Capacitor 7 não compila com o 17) e o Android SDK.
Instalando o Android Studio você ganha os dois — ele traz o JBR 21 embutido.

```bash
npm run build && npx cap sync
```

```bash
npx cap open android
```

No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. O arquivo sai em
`android/app/build/outputs/apk/debug/app-debug.apk` — copie para o celular e instale
(é preciso liberar "instalar de fontes desconhecidas").

Pela linha de comando, sem abrir o Android Studio:

```bash
cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
```

### APK/AAB assinado (release)

1. Gere um keystore (uma vez só; **guarde o arquivo e as senhas**):

```bash
keytool -genkey -v -keystore tecnicadex.keystore -alias tecnicadex -keyalg RSA -keysize 2048 -validity 10000
```

2. No Android Studio: **Build → Generate Signed Bundle / APK**, escolha APK (instalar
   direto no celular) ou AAB (publicar na Play Store), aponte o keystore e selecione a
   variante `release`.

O keystore está no `.gitignore` — não versione.

## 5. Importar dados do artefato do claude.ai

Os dois ambientes têm armazenamento separado; a ponte é um JSON exportado.

**No artefato (claude.ai):** aba **Minha Pokédex** → **Copiar** ou **Baixar .json**.
O pacote é `{ saved, detailCache, exportedAt, version }`.

**No app:** ícone de upload no topo → cole o JSON no campo, ou toque em
**Selecionar arquivo .json** e escolha o arquivo baixado.

A importação **mescla**, nunca substitui:

- assuntos novos são adicionados; os existentes recebem só as técnicas que faltavam;
- técnica com o mesmo `id` nos dois lados: vence a de `savedAt` mais recente;
- `detailCache`: chaves novas entram, chaves já existentes localmente são preservadas
  (o guia não muda, não há motivo para reescrever);
- ao final aparece um resumo com quantos assuntos e técnicas entraram, quantas foram
  atualizadas e quantas já existiam.

Na mesma tela há **Salvar backup deste aparelho**, que grava o mesmo formato em
`Documentos/tecnicadex-backup.json` (Android) ou baixa o arquivo (navegador) — útil para
mover dados entre aparelhos ou reinstalar o app sem perder nada.

## 6. Estrutura

```
src/
  App.jsx                  casca do aparelho, navegação (Buscar/Pokédex/Coleções) e fluxo de busca
  theme.js                 cores, paleta de tipos, slug, estilos comuns
  utilities.css            subconjunto das utilitárias usadas no artefato
  state/
    DataContext.jsx         provider dos dados capturados + todos os mutadores (useData())
    PrefsContext.jsx        provider das preferências e da memória de uso (usePrefs())
    searchReducer.js        reducer do fluxo de busca (digitar → buscar → resultado/erro)
  components/
    CardShell.jsx           a casca comum de TODO card (moldura, cabeçalho, tags, nota)
    TechCard.jsx            card da técnica (+ botão Aprofundar)
    DefinitionCard.jsx      card do verbete de conceito (modo def:)
    ListItemCard.jsx        card de item de enumeração (modo list:)
    WordCard.jsx            card de palavra (modo pal:) + pronúncia por voz do sistema
    PlantCard.jsx           card de planta: foto, ficha e os 4 aspectos sob demanda
    PlantPhoto.jsx          a foto do topo do card de planta (ou o botão de anexar)
    StatBar.jsx             barra de 5 blocos das stats
    PokeballIcon.jsx        ícone de captura
    TagEditor.jsx           chips de tag livre num item salvo
    NoteEditor.jsx          anotação pessoal livre num item salvo
    ConvertButton.jsx       menu de converter o card em outro tipo
    EnrichPrompt.jsx        faixa "completar com IA" num card convertido incompleto
    CollectionPicker.jsx    bottom sheet pra escolher/criar coleção na seleção em lote
    CollectionsSection.jsx  a aba "Coleções"
  views/
    SearchView.jsx          busca, loading, erro, aviso de chave ausente, origem do resultado
    DexView.jsx             Pokédex com as categorias Técnicas/Conceitos/Plantas/Palavras
    WordsView.jsx           categoria "Palavras": o acervo, em pastas por idioma
    DetailPage.jsx          guia passo a passo + sinais de acerto/erro
    SettingsView.jsx        chave, proxy, tema, esforço, modelo por modo, cache, teto de gasto
    ImportView.jsx          importar JSON, backup, export em PDF, Markdown e Anki
  lib/
    storage.js              get/set/delete/list sobre @capacitor/preferences
    speech.js                pronúncia via speechSynthesis (escolha de voz por idioma)
    savedModel.js           forma canônica de `saved` e acessos a ela (kind por item)
    plants.js               modelo dos itens do tipo planta (grupo por família, id, texto livre)
    convert.js              conversão de um card entre técnica/conceito/tipo
    migrations.js           versão do schema persistido + migrações em ordem
    anthropic.js            chamadas à API, prompts e erros tratados
    models.js               qual modelo cada tarefa usa, e o preço de cada um
    usage.js                contador de uso por modelo e por mês + o teto mensal
    searchCache.js          cache dos resultados de busca (chave, TTL, poda)
    imageUtils.js           compressão das fotos anexadas antes de gravar/enviar
    searchQuery.js          parse dos prefixos tec:/def:/list:/cmp:/pal:/plt:
    importer.js             validação e merge do payload importado
    collections.js          resolução de refs de coleções manuais contra `saved`
    ankiExport.js           gera o CSV de export para o Anki (itens + palavras)
  test/
    setup.js                setup do vitest (jest-dom + cleanup)
    renderWithData.jsx      render de view dentro dos providers reais
    storageMock.js          storage em memória no lugar do @capacitor/preferences
extracted/efeitos/         a antiga aba "Efeitos", extraída pra virar outro app (ver o README de lá)
proxy/cloudflare-worker.js proxy opcional (plano B)
```

### Estado: contexto + reducer

Os dados capturados (`saved`, `detailCache`, `words`, `collections`) e todas as
operações que os alteram vivem em `src/state/DataContext.jsx`. As preferências e a
memória de uso — tema, esforço e modelo de busca, aba e categoria correntes, histórico,
fila offline, itens marcados como pouco relevantes — vivem em
`src/state/PrefsContext.jsx`. As views puxam o que precisam com `useData()` e
`usePrefs()` em vez de receber dezenas de props do `App.jsx`, que ficou só com navegação
e o fluxo de busca. Esse fluxo é um reducer puro (`src/state/searchReducer.js`), testado
sem renderizar nada.

### A casca comum dos cards

Os cinco cards (técnica, conceito, tipo, palavra, planta) repetiam a mesma estrutura —
moldura, estado de seleção, cabeçalho com título e fila de ícones, chips de tag, editor
de nota — cada um com sua cópia dos estilos. Isso agora é `components/CardShell.jsx`, e
cada card fica sendo só o que é próprio dele: o miolo e a lista de ações do cabeçalho. A
pokébola de captura é prop da casca, não um item da lista de ações, pra que nenhum card
consiga colocá-la fora de ordem.

### Modelo dos dados: `kind` é do item

```
saved[assunto] = { displayName, items: [ { id, kind, ... } ] }
```

`kind` é `"technique"`, `"definition"`, `"list"` ou `"plant"` e mora no ITEM, não
no grupo — um mesmo assunto guarda tipos diferentes lado a lado, e cada categoria da
Pokédex mostra o recorte dela do mesmo assunto. As categorias não são os `kind`:
`categoryOfKind()` junta definição e tipo em **Conceitos** e deixa planta sozinha em
**Plantas**, porque o card e os campos dela não se parecem com nenhum outro. Os acessos
passam por `src/lib/savedModel.js` (`groupItems`, `itemKind`, `itemLabel`, `withItems`,
`categoryOfKind`), que também lê os formatos antigos, porque payloads importados chegam
neles.

Converter card entre tipos só vale para os três primeiros (`ITEM_KINDS`); planta fica
fora, porque não há campo em comum que a conversão soubesse remapear.

### Converter um card entre tipos

O botão de converter (ícone de setas no card) troca o `kind` e remapeia os
campos localmente — instantâneo, offline, sem custo de API. O item continua no
mesmo assunto, com o mesmo `id`, `savedAt`, tags, nota e imagens, então as refs
de coleção seguem válidas e o toast desfaz a conversão como qualquer outra
edição (`src/lib/convert.js`).

O que a conversão não deduz sozinha — stats e "ideal para" de uma técnica,
pontos-chave e exemplo de um conceito — fica em branco, e o card marcado como
convertido oferece **Completar com IA**, que preenche só o que falta e nunca
sobrescreve o que você já tinha escrito. O card é usável sem isso; a chamada à
API só acontece se você tocar no botão.

### Versão do schema e migrações

Tudo que é persistido carrega uma versão em `KEYS.schemaVersion`. Na abertura o
`DataProvider` roda as migrações pendentes em ordem (`src/lib/migrations.js`), uma vez
só, regrava os dados e sobe a versão. Para criar uma migração: adicione uma entrada em
`MIGRATIONS` com a versão de destino e uma função pura `(data) => data`, e suba
`CURRENT_SCHEMA_VERSION`. Payloads importados passam pelas mesmas migrações antes de
entrar no estado — inclusive as coleções, porque a v3 pode renomear ids e precisa
reescrever as refs junto.

Versões até aqui: **v1** normaliza grupos legados; **v2** remove os campos das
funcionalidades de revisão e vínculo, que saíram do app; **v3** move `kind` pro
item, funde os antigos grupos `kn:<assunto>` no assunto de mesmo nome
(renomeando ids que colidem) e reescreve as refs de coleção afetadas.

Chaves de armazenamento (prefixadas com `tecnicadex:`): `pokedex-saved`,
`pokedex-details`, `saved-words`, `anthropic-api-key`, `anthropic-proxy-url`,
`search-history`, `search-cache`, `search-models`, `usage-stats`, `monthly-budget-usd`,
`collections`, `schema-version`, `prefetch-details-enabled`, entre outras (ver `KEYS` em
`src/lib/storage.js`). Cada item salvo tem um campo `note` de anotação pessoal livre,
além de `tags`.

A chave `effect-profiles` continua gravada nos aparelhos que usavam a aba **Efeitos**,
mas o app não a lê nem a escreve mais — ver `extracted/efeitos/README.md`.

`collections` guarda pastas manuais que cruzam itens de assuntos diferentes: cada
coleção é `{ id, name, createdAt, refs: [{subjectKey, itemId}] }` — as refs apontam pro
item real em `pokedex-saved` (nunca duplicam o dado); uma ref cujo item foi removido da
Pokédex simplesmente some da exibição.

### Plantas

Uma planta entra de dois jeitos: pelo nome (`plt: alecrim`) ou pelo botão de câmera, que
manda a foto pra API identificar. A ficha que volta é curta de propósito — nome
científico, nomes populares e um resumo de 2 a 3 linhas — e o card traz quatro
botões-ícone que geram, **sob demanda e um por vez**, um bloco de 3 a 5 linhas sobre
origem e história, como identificar no campo, solo/clima/ciclo e usos medicinais. Assim
o custo por planta é o de uma chamada curta, e você só paga pelos aspectos que quiser.

A foto fica no topo do card, sempre no mesmo tamanho (`object-fit: cover`), pra que uma
lista de plantas tenha cards do mesmo formato. Planta capturada por nome mostra ali o
botão de anexar foto depois — a moldura não muda de altura ao ganhar a imagem, então
nada salta na tela. As fotos são comprimidas antes de gravar (`lib/imageUtils.js`).

Na Pokédex, plantas são agrupadas pela **família botânica** que a API devolveu, não por
um assunto digitado: é parentesco real, decidido sem você ter que inventar uma pasta. O
id do item é o nome científico em slug, o que dedupa de graça — a mesma espécie
fotografada duas vezes cai no mesmo card.

### Modelos e custo

Cada tarefa aponta pra um modelo em `src/lib/models.js`:

- **fixo em Sonnet** o que exige raciocínio: guias, aprofundamentos de conceito e de
  passo, sugestões de meta, e os quatro aspectos da planta;
- **fixo em Haiku** o que é recuperação estruturada: verbete de palavra, etimologia,
  nomes relacionados e o "completar com IA" de um card convertido;
- **escolhido por você** nos modos de busca (Técnicas, Conceito, Tipos, Comparar,
  Plantas), em Configurações. O padrão é Sonnet, exceto **Tipos**, que já vem em Haiku.

O contador de uso é por modelo e por mês (`src/lib/usage.js`), e Configurações mostra a
tabela com chamadas, tokens e custo estimado de cada um. O **teto mensal** é em dólares:
atingido, o app para de chamar a API até você subir o limite ou o mês virar — o que já
está capturado continua acessível. Zerar o contador não apaga o histórico mensal, senão
o teto seria contornável com um toque.

### Memorização: é no Anki

O app não tem revisão espaçada nem flashcards próprios — quem quiser memorizar exporta
os cartões pelo ícone de upload no topo → **Exportar para Anki**. O CSV cobre técnicas
(com o guia já cacheado no verso), conceitos, tipos, plantas (com os aspectos já
gerados) e palavras (com pinyin, radical e a decomposição por caractere), cada cartão
etiquetado com `bookdex::<tipo>` e o assunto ou idioma de origem.

## 7. Testes

```bash
npm test
```

`vitest` com `jsdom` como ambiente padrão, rodando só `src/**` (o que está em
`extracted/` não é compilado nem testado aqui): as libs puras são testadas direto e as
views (`DexView`, `WordsView`, `ImportView`) com Testing Library, renderizadas dentro
dos providers reais e com o storage substituído por um mock em memória — ou seja, o
teste exercita provider e view juntos, como no app. O CI (`.github/workflows/ci.yml`) roda
`npm test` e `npm run build` a cada push e PR.

## 8. Notas

- `appId`: `com.pedroteles.tecnicadex`. Para mudar, edite `capacitor.config.json` e rode
  `npx cap sync` (ou recrie a pasta `android/`).
- Ícone e identidade visual são próprios (lente de scanner sobre vermelho); nenhum
  elemento de marca de terceiros é usado.
- Modelos usados: `claude-sonnet-5` e `claude-haiku-4-5-20251001`, thinking adaptativo.
  Quem escolhe qual é `src/lib/models.js`; os modos de busca são configuráveis em
  Configurações (ver §6, "Modelos e custo").
- Sem busca por voz (a WebView do Android costuma não expor `SpeechRecognition`), mas
  o card de palavra tem pronúncia via `speechSynthesis` do sistema — offline, sem custo
  de API (`src/lib/speech.js`).
