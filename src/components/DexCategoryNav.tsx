import { tabStyle } from "../theme";
import { usePrefs } from "../state/PrefsContext";

interface DexCategoryNavProps {
  counts: { techniques: number; knowledge: number; words: number };
}

/**
 * As categorias da Pokédex vivem na barra de baixo (aqui) mas quem filtra por
 * elas é o DexView, do outro lado da tela — por isso a categoria corrente mora
 * no PrefsContext, e não em nenhum dos dois.
 */
export default function DexCategoryNav({ counts }: DexCategoryNavProps) {
  const { dexCategory, setDexCategory } = usePrefs();
  return (
    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
      <button onClick={() => setDexCategory("technique")} style={tabStyle(dexCategory === "technique")}>
        TÉCNICAS ({counts.techniques})
      </button>
      <button onClick={() => setDexCategory("knowledge")} style={tabStyle(dexCategory === "knowledge")}>
        CONCEITOS ({counts.knowledge})
      </button>
      <button onClick={() => setDexCategory("words")} style={tabStyle(dexCategory === "words")}>
        PALAVRAS ({counts.words})
      </button>
    </div>
  );
}
