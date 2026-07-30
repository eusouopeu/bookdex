# Bookdex

App standalone (Android via Capacitor + PWA) da Bookdex — escaneie um assunto,
compare 6 técnicas lado a lado, capture as que interessam e abra o guia passo a passo.

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

> Custo: cada busca gasta ~1k tokens de saída e cada guia ~1,2k, sempre no modelo
> `claude-sonnet-5` com esforço médio e thinking adaptativo ligado (fixo no código,
> não é configurável na UI). A cobrança cai na sua conta da Anthropic.

### Plano B: proxy (só se der CORS)

A chamada direta é a implementação padrão e deve funcionar tanto no APK quanto no PWA.
Se em algum ambiente ela for bloqueada por CORS, use o Worker de exemplo em
[proxy/cloudflare-worker.js](proxy/cloudflare-worker.js): ele só repassa a requisição e
injeta a chave guardada no servidor. Depois de publicar, cole a URL em
**Configurações → Proxy**; o app passa a usar esse endereço em vez da API direta.

## 3. Modos de busca

O campo de busca aceita três prefixos, cada um com seu próprio prompt e formato de card:

| Prefixo | Modo | O que retorna |
| --- | --- | --- |
| `tec: assunto` (ou sem prefixo) | Técnicas | 6 técnicas comparadas com barras de stats (comportamento original) |
| `def: termo` | Conceito | Um verbete único: definição, pontos-chave, exemplo e termos relacionados |
| `list: assunto` | Tipos | De 5 a 10 itens enumerando tipos/categorias do assunto |

Cada modo tem seu próprio ícone de captura. Na aba **Minha Pokédex**, uma badge no topo
alterna entre **Técnicas** e **Conceitos & Tipos**, já que os dois grupos têm exibição e
dados diferentes (grupos de conhecimento guardam `items`, grupos de técnica guardam
`techniques`). Importação e exportação cobrem os três modos.

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
  App.jsx                  casca do aparelho, navegação e estado compartilhado
  theme.js                 cores, paleta de tipos, slug, estilos comuns
  utilities.css            subconjunto das utilitárias usadas no artefato
  components/
    TechCard.jsx           card da técnica (+ botão Aprofundar)
    DefinitionCard.jsx     card do verbete de conceito (modo def:)
    ListItemCard.jsx       card de item de enumeração (modo list:)
    StatBar.jsx            barra de 5 blocos das stats
    PokeballIcon.jsx       ícone de captura
  views/
    SearchView.jsx         busca, loading, erro, aviso de chave ausente
    DexView.jsx            Pokédex com badge Técnicas/Conceitos & Tipos e pastas por assunto
    DetailPage.jsx         guia passo a passo + sinais de acerto/erro
    SettingsView.jsx       API key e proxy
    ImportView.jsx         importar JSON (colado ou arquivo) e backup
  lib/
    storage.js             get/set/delete/list sobre @capacitor/preferences
    anthropic.js           chamadas à API, prompts e erros tratados (técnica/def/list)
    searchQuery.js          parse dos prefixos tec:/def:/list:
    importer.js            validação e merge do payload importado
proxy/cloudflare-worker.js proxy opcional (plano B)
```

Chaves de armazenamento (prefixadas com `tecnicadex:`): `pokedex-saved`,
`pokedex-details`, `anthropic-api-key`, `anthropic-proxy-url`. Dentro de `pokedex-saved`,
grupos de técnica guardam um array `techniques`; grupos de conceito/tipo (`kind:
"definition"` ou `"list"`) guardam um array `items` e são prefixados com `kn:` para não
colidir com o slug de um assunto de técnica igual.

## 7. Notas

- `appId`: `com.pedroteles.tecnicadex`. Para mudar, edite `capacitor.config.json` e rode
  `npx cap sync` (ou recrie a pasta `android/`).
- Ícone e identidade visual são próprios (lente de scanner sobre vermelho); nenhum
  elemento de marca de terceiros é usado.
- Modelo usado: `claude-sonnet-5`, esforço `medium`, thinking adaptativo — fixo em
  `src/lib/anthropic.js`, sem seleção de modelo em nenhuma tela.
