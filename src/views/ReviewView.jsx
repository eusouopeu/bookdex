import { useMemo, useState } from "react";
import { ArrowLeft, Brain, Check, X, Sparkles } from "lucide-react";
import { COLORS, getTypeColor, primaryButtonStyle } from "../theme";
import { getDueQueue } from "../lib/review";

/**
 * Flashcards de revisão espaçada (Leitner) sobre os itens já salvos.
 * Um item por vez: mostra a frente (nome/termo), o usuário revela a resposta
 * e se auto-avalia — isso empurra o próximo `nextReviewAt` mais pra frente ou
 * de volta pra caixa 0.
 */
export default function ReviewView({ saved, onBack, onGrade }) {
  const queue = useMemo(() => getDueQueue(saved), [saved]);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const current = queue[pos];

  function reveal() {
    setRevealed(true);
  }

  function grade(correct) {
    onGrade(current.subjectKey, current.item.id, current.kind, correct);
    setDoneCount((c) => c + 1);
    setRevealed(false);
    setPos((p) => p + 1);
  }

  function cardFront(entry) {
    return entry.kind === "definition" ? entry.item.term : entry.item.name;
  }

  function cardBack(entry) {
    if (entry.kind === "definition") return entry.item.definition;
    if (entry.kind === "list") return entry.item.description;
    return entry.item.description ? `${entry.item.description}\n\nIdeal para: ${entry.item.bestFor || "—"}` : "";
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5"
        style={{
          background: "none",
          border: "none",
          color: COLORS.ink,
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "12.5px",
          cursor: "pointer",
          padding: "8px 8px 8px 0",
          minHeight: "40px",
          marginBottom: "4px",
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="flex items-center gap-2" style={{ marginBottom: "4px" }}>
        <Brain size={18} style={{ color: COLORS.ink }} />
        <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, margin: 0 }}>
          Revisão
        </h2>
      </div>

      {queue.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "300px", color: COLORS.screenBorder }}>
          <Sparkles size={32} strokeWidth={1.5} style={{ marginBottom: "10px" }} />
          <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "15px", color: COLORS.ink }}>
            Tudo revisado por hoje!
          </p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", maxWidth: "230px", marginTop: "4px" }}>
            Capture mais itens na Pokédex ou volte amanhã — os itens vencidos aparecem aqui automaticamente.
          </p>
        </div>
      )}

      {queue.length > 0 && !current && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "300px", color: COLORS.screenBorder }}>
          <Check size={32} strokeWidth={1.5} style={{ marginBottom: "10px", color: "var(--success)" }} />
          <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "15px", color: COLORS.ink }}>
            {doneCount} revisão(ões) concluída(s)!
          </p>
          <button onClick={onBack} style={{ ...primaryButtonStyle, marginTop: "14px" }}>
            Voltar à Pokédex
          </button>
        </div>
      )}

      {current && (
        <div>
          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
            {pos + 1} de {queue.length} · {current.subjectDisplay}
          </p>
          <div
            onClick={!revealed ? reveal : undefined}
            style={{
              background: COLORS.surface,
              border: `2px solid ${COLORS.screenBorder}`,
              borderRadius: "12px",
              padding: "22px 16px",
              minHeight: "180px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              cursor: !revealed ? "pointer" : "default",
            }}
          >
            <span
              style={{
                display: "inline-block",
                background: getTypeColor(current.item.type || current.item.category).bg,
                color: getTypeColor(current.item.type || current.item.category).text,
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 9px",
                borderRadius: "999px",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              {current.item.type || current.item.category || current.kind}
            </span>
            <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "20px", color: COLORS.ink, marginBottom: "10px" }}>
              {cardFront(current)}
            </h3>
            {!revealed ? (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)" }}>Toque para revelar</p>
            ) : (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                {cardBack(current)}
              </p>
            )}
          </div>

          {revealed && (
            <div className="flex gap-2" style={{ marginTop: "14px" }}>
              <button
                onClick={() => grade(false)}
                className="flex items-center justify-center gap-1.5"
                style={{
                  ...primaryButtonStyle,
                  flex: 1,
                  background: "transparent",
                  border: "2px solid #8a1f1f",
                  color: "var(--danger)",
                }}
              >
                <X size={15} /> Errei
              </button>
              <button
                onClick={() => grade(true)}
                className="flex items-center justify-center gap-1.5"
                style={{
                  ...primaryButtonStyle,
                  flex: 1,
                  background: "var(--success)",
                  border: "2px solid #2E7D32",
                }}
              >
                <Check size={15} /> Acertei
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
