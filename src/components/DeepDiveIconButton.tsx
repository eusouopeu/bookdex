import { BookOpen, Sparkles, Loader2 } from "lucide-react";
import { COLORS } from "../theme";

/**
 * Botão-ícone de "aprofundar" pro cabeçalho dos cards — livro aberto quando o
 * aprofundamento já foi gerado, estrelinhas quando ainda vai pedir pra IA.
 * Usado por TechCard (guia persistido) e DefinitionCard/ListItemCard
 * (deep dive de conceito, via useConceptDeepDive).
 */
export default function DeepDiveIconButton({ hasContent, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={hasContent ? "Ver aprofundamento" : "Aprofundar (gera com IA)"}
      title={hasContent ? "Ver aprofundamento" : "Aprofundar (gera com IA)"}
      style={{
        background: "none",
        border: "none",
        cursor: loading ? "default" : "pointer",
        padding: "9px",
        margin: "-9px",
        flexShrink: 0,
        color: COLORS.screenBorder,
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} />
      ) : hasContent ? (
        <BookOpen size={15} />
      ) : (
        <Sparkles size={15} />
      )}
    </button>
  );
}
