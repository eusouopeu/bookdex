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
  const tabs = [
    { id: "technique", label: `TÉCNICAS (${counts.techniques})` },
    { id: "knowledge", label: `CONCEITOS (${counts.knowledge})` },
    { id: "words", label: `PALAVRAS (${counts.words})` },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setDexCategory(t.id)} aria-pressed={dexCategory === t.id} className="dex-tab">
          {t.label}
        </button>
      ))}
    </div>
  );
}
