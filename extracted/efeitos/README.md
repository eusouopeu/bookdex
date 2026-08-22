# Efeitos — código extraído do Bookdex

A aba **Efeitos** saiu do Bookdex para virar um app próprio. Esta pasta guarda o
código dela inteiro, do jeito que rodava, para servir de ponto de partida.

Nada aqui é compilado pelo Bookdex: `vite.config.js` só enxerga `src/`, e nenhum
arquivo de `src/` importa desta pasta.

## O que tem aqui

```
src/components/EffectsSection.jsx        tela principal (lista de perfis + criação)
src/components/EffectProfileDetail.jsx   um perfil: critérios, itens, notas, total
src/components/EffectRatingBar.jsx       barra de -5 a +5 de um critério
src/components/EffectSuggestionsPanel.jsx  sugestões de adição/substituição via IA
src/lib/effectProfiles.js                modelo de dados puro (ids, clamp, somatórios)
src/lib/effectProfiles.test.js           testes do modelo (vitest)
src/lib/effectsApi.js                    os dois prompts + chamadas à API
src/state/useEffectProfiles.js           estado + persistência, como hook
```

## Dependências que o app novo precisa ter

- **React 18+** e **lucide-react** (ícones usados pelos componentes).
- Um módulo de tema exportando `COLORS`, `primaryButtonStyle` e `slug()` — no
  Bookdex é `src/theme.js`. Os componentes importam de `"../theme"`.
- Um cliente de API exportando `sendMessageJSON({ system, user, maxTokens })` e
  `MissingApiKeyError` — no Bookdex é `src/lib/anthropic.js`. `effectsApi.js`
  importa de `"./anthropic"`.
- Um storage com `getJSON(key, fallback)` / `setJSON(key, value)` — no Bookdex é
  `src/lib/storage.js`.

## Os dados de quem já usava

Ficam gravados no aparelho sob a chave `effect-profiles` (via
`@capacitor/preferences`, prefixadas com `tecnicadex:` — a chave completa no
storage é `tecnicadex:effect-profiles`). O Bookdex parou de ler e de escrever
nessa chave, mas **não a apagou**: o app novo pode ler o mesmo valor e continuar
de onde parou, ou o usuário pode recomeçar do zero.

Formato:

```jsonc
{
  "<profileId>": {
    "id": "...",
    "name": "Suplementos",
    "createdAt": 1730000000000,
    "criteria": [{ "id": "sono", "label": "Sono" }],
    "items": [
      {
        "id": "melatonina",
        "name": "Melatonina",
        "active": true,
        "ratings": { "sono": 4 },     // -5 a +5
        "reasons": { "sono": "..." },
        "note": ""
      }
    ]
  }
}
```

## Como montar o app novo

```jsx
import { useEffectProfiles } from "./state/useEffectProfiles";
import EffectsSection from "./components/EffectsSection";
import storage from "./lib/storage";

export default function App() {
  const effects = useEffectProfiles(storage);
  return <EffectsSection {...effects} />;
}
```

`EffectsSection` espera exatamente as props que o hook devolve (`profiles`,
`onCreateProfile`, `onDeleteProfile`, `onAddCriterion`, `onRemoveCriterion`,
`onAddItem`, `onRemoveItem`, `onToggleItemActive`, `onUpdateItemRating`,
`onUpdateItemNote`) — era assim que o `App.jsx` do Bookdex a chamava.
