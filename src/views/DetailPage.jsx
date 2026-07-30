import { useEffect, useState } from "react";
import { ArrowLeft, Check, X, RefreshCw, KeyRound } from "lucide-react";
import { COLORS, getTypeColor, primaryButtonStyle } from "../theme";
import { fetchDetail, MissingApiKeyError } from "../lib/anthropic";

export default function DetailPage({ subjectDisplay, technique, cacheKey, detailCache, onCached, onBack, onGoSettings }) {
  const cached = detailCache[cacheKey];
  const [detail, setDetail] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [needsKey, setNeedsKey] = useState(false);
  const color = getTypeColor(technique.type);

  async function load() {
    setLoading(true);
    setError(null);
    setNeedsKey(false);
    try {
      const parsed = await fetchDetail(subjectDisplay, technique);
      setDetail(parsed);
      onCached(cacheKey, parsed);
    } catch (e) {
      if (e instanceof MissingApiKeyError) setNeedsKey(true);
      else setError(e.message || "Não foi possível gerar o guia agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cached) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

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

      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "#6b7a60" }}>
        {subjectDisplay}
      </div>
      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "19px", color: COLORS.ink, lineHeight: 1.15 }}>
        {technique.name}
      </h2>
      <span
        style={{
          display: "inline-block",
          background: color.bg,
          color: color.text,
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 9px",
          borderRadius: "999px",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          margin: "6px 0 12px",
        }}
      >
        {technique.type}
      </span>

      {loading && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "260px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: `4px solid ${COLORS.screenBorder}`,
              borderTopColor: COLORS.lensBlue,
              animation: "spin 0.9s linear infinite",
              marginBottom: "12px",
            }}
          />
          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "12px", color: COLORS.ink, letterSpacing: "0.04em" }}>
            MONTANDO O GUIA...
          </p>
        </div>
      )}

      {!loading && needsKey && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "240px" }}>
          <KeyRound size={32} strokeWidth={1.5} style={{ marginBottom: "10px", color: COLORS.screenBorder }} />
          <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "14px", color: COLORS.ink }}>
            Configure sua API key
          </p>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              color: COLORS.screenBorder,
              maxWidth: "250px",
              marginTop: "4px",
              marginBottom: "14px",
            }}
          >
            O guia passo a passo é gerado pela API da Anthropic e precisa da sua chave.
          </p>
          <button onClick={onGoSettings} style={primaryButtonStyle}>
            Abrir Configurações
          </button>
        </div>
      )}

      {!loading && !needsKey && error && (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "240px" }}>
          <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, color: "#8a1f1f", marginBottom: "6px", fontSize: "15px" }}>
            Sinal perdido
          </p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: COLORS.ink, maxWidth: "240px", marginBottom: "12px" }}>
            {error}
          </p>
          <button onClick={load} className="flex items-center gap-1.5" style={primaryButtonStyle}>
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      )}

      {!loading && detail && (
        <div style={{ animation: "flicker 0.4s ease-out" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "#3a3a30", lineHeight: 1.45, marginBottom: "14px" }}>
            {detail.overview}
          </p>

          <SectionTitle>Passo a passo</SectionTitle>
          {(detail.steps || []).map((step, i) => (
            <div
              key={i}
              className="flex gap-2"
              style={{
                background: COLORS.white,
                border: `2px solid ${COLORS.screenBorder}`,
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 700,
                  fontSize: "12px",
                  color: color.text,
                  background: color.bg,
                  borderRadius: "6px",
                  width: "22px",
                  height: "22px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13.5px", color: COLORS.ink }}>
                  {step.title}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#3a3a30", lineHeight: 1.4 }}>
                  {step.detail}
                </div>
              </div>
            </div>
          ))}

          {!!(detail.rightSigns || []).length && (
            <>
              <SectionTitle>Sinais de que está certo</SectionTitle>
              <SignList items={detail.rightSigns} good />
            </>
          )}

          {!!(detail.wrongSigns || []).length && (
            <>
              <SectionTitle>Sinais de que está errado</SectionTitle>
              <SignList items={detail.wrongSigns} />
            </>
          )}

          {detail.tip && (
            <div
              style={{
                marginTop: "14px",
                background: "rgba(255,201,71,0.25)",
                border: `2px solid ${COLORS.gold}`,
                borderRadius: "10px",
                padding: "10px 12px",
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                color: COLORS.ink,
                lineHeight: 1.4,
              }}
            >
              <strong style={{ fontFamily: '"Baloo 2", sans-serif' }}>Dica:</strong> {detail.tip}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3
      style={{
        fontFamily: '"Baloo 2", sans-serif',
        fontWeight: 800,
        fontSize: "14px",
        color: COLORS.ink,
        borderBottom: `2px solid ${COLORS.screenBorder}`,
        paddingBottom: "4px",
        margin: "16px 0 9px",
      }}
    >
      {children}
    </h3>
  );
}

function SignList({ items, good }) {
  const accent = good ? "#2E7D32" : "#8a1f1f";
  const Icon = good ? Check : X;
  return (
    <div>
      {items.map((s, i) => (
        <div key={i} className="flex items-start gap-2" style={{ marginBottom: "7px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: accent,
              color: "#fff",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "1px",
            }}
          >
            <Icon size={12} strokeWidth={3} />
          </div>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#3a3a30", lineHeight: 1.4 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}
