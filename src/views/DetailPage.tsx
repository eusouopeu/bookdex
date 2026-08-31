import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X, RefreshCw, KeyRound, Share2, FileDown, Plus, Minus, Loader2, Trash2, ExternalLink } from "lucide-react";
import { COLORS, getTypeColor, primaryButtonStyle, slug } from "../theme";
import { fetchDetail, fetchStepDeepDive, MissingApiKeyError } from "../lib/anthropic";
import { useProgressiveMessage } from "../lib/hooks";
import { estimateCost, formatCost } from "../lib/models";
import { GuideSkeleton } from "../components/Skeleton";
import { shareOrCopyText, shareOrDownloadFile, guideMarkdown } from "../lib/share";

const SWIPE_EDGE_PX = 28;
const SWIPE_THRESHOLD_PX = 70;

const headerIconBtnStyle = {
  background: "transparent",
  border: `2px solid ${COLORS.screenBorder}`,
  borderRadius: "8px",
  color: COLORS.ink,
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

export default function DetailPage({ subjectDisplay, technique, cacheKey, detailCache, onCached, onDeleteDetail, onBack, onGoSettings, onOpenInSinergia }) {
  const cached = detailCache[cacheKey];
  const [detail, setDetail] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [shareMsg, setShareMsg] = useState(null);
  const [stepBreakdowns, setStepBreakdowns] = useState({}); // { [i]: { loading, error, substeps, open } }
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const color = getTypeColor(technique.type);
  const loadingMsg = useProgressiveMessage(loading, ["MONTANDO O GUIA...", "AINDA MONTANDO...", "QUASE PRONTO..."]);
  const touch = useRef({ active: false, x: 0, y: 0 });

  function flashShareMsg(msg) {
    setShareMsg(msg);
    setTimeout(() => setShareMsg((m) => (m === msg ? null : m)), 2200);
  }

  async function handleShareGuide() {
    const text = [
      `${technique.name} — ${subjectDisplay}`,
      detail.overview,
      ...(detail.steps || []).map((s, i) => `${i + 1}. ${s.title}: ${s.detail}`),
      "",
      "via Cognidex",
    ].join("\n");
    const outcome = await shareOrCopyText(technique.name, text);
    if (outcome === "copied") flashShareMsg("Guia copiado para a área de transferência.");
    else if (outcome === "failed") flashShareMsg("Não foi possível compartilhar.");
  }

  async function handleExportGuide() {
    const md = guideMarkdown(subjectDisplay, technique, detail);
    const fileName = `${slug(technique.name)}.md`;
    const outcome = await shareOrDownloadFile(fileName, md, "text/markdown", technique.name);
    if (outcome === "downloaded") flashShareMsg("Guia exportado em .md.");
  }

  async function toggleStepBreakdown(i, step) {
    const current = stepBreakdowns[i];
    if (current && current.substeps) {
      setStepBreakdowns((prev) => ({ ...prev, [i]: { ...current, open: !current.open } }));
      return;
    }
    setStepBreakdowns((prev) => ({ ...prev, [i]: { loading: true, error: null, substeps: null, open: true } }));
    try {
      const substeps = await fetchStepDeepDive(subjectDisplay, technique, step);
      setStepBreakdowns((prev) => ({ ...prev, [i]: { loading: false, error: null, substeps, open: true } }));
    } catch (e) {
      const msg = e instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : e.message || "Não foi possível aprofundar este passo.";
      setStepBreakdowns((prev) => ({ ...prev, [i]: { loading: false, error: msg, substeps: null, open: true } }));
    }
  }

  function onTouchStart(e) {
    const t = e.touches[0];
    touch.current = { active: t.clientX < SWIPE_EDGE_PX, x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e) {
    if (!touch.current.active) return;
    touch.current.active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = Math.abs(t.clientY - touch.current.y);
    if (dx > SWIPE_THRESHOLD_PX && dy < 60) onBack();
  }

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

  /** Apaga o guia do cache e busca outro — pede confirmação porque descarta o atual. */
  function handleRegenerate() {
    if (!confirmingRegenerate) {
      setConfirmingRegenerate(true);
      return;
    }
    setConfirmingRegenerate(false);
    if (onDeleteDetail) onDeleteDetail(cacheKey);
    setDetail(null);
    setStepBreakdowns({});
    load();
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-start gap-2" style={{ justifyContent: "space-between", marginBottom: "2px" }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5"
          aria-label={`Voltar — ${technique.name}`}
          style={{
            background: "none",
            border: "none",
            color: COLORS.ink,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 800,
            fontSize: "19px",
            cursor: "pointer",
            padding: "8px 0",
            minHeight: "40px",
            minWidth: 0,
          }}
        >
          <ArrowLeft size={18} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{technique.name}</span>
        </button>

        <div className="flex items-center gap-1.5" style={{ flexShrink: 0, paddingTop: "8px" }}>
          {onOpenInSinergia && (
            <button
              onClick={() => onOpenInSinergia(technique.name)}
              aria-label={`Avaliar "${technique.name}" no Sinergia`}
              title="Avaliar no Sinergia"
              style={headerIconBtnStyle}
            >
              <ExternalLink size={14} />
            </button>
          )}
          {detail && (
            <>
            <button onClick={handleExportGuide} aria-label="Exportar guia em .md" title="Exportar .md" style={headerIconBtnStyle}>
              <FileDown size={14} />
            </button>
            <button onClick={handleShareGuide} aria-label="Compartilhar guia" title="Compartilhar" style={headerIconBtnStyle}>
              <Share2 size={14} />
            </button>
            {onDeleteDetail && (
              <button
                onClick={handleRegenerate}
                onBlur={() => setConfirmingRegenerate(false)}
                aria-label={confirmingRegenerate ? "Confirmar e regenerar guia" : "Apagar guia e gerar outro"}
                title={confirmingRegenerate ? "Confirmar?" : `Apagar e gerar outro (~${formatCost(estimateCost("detail"))})`}
                style={{
                  ...headerIconBtnStyle,
                  color: "var(--danger)",
                  borderColor: "var(--danger)",
                  background: confirmingRegenerate ? "rgba(198,40,40,0.12)" : "transparent",
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
            </>
          )}
        </div>
      </div>

      <div style={{ fontFamily: "Inter, sans-serif", fontStyle: "italic", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
        {subjectDisplay}
      </div>
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
        <div>
          <p
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "12px",
              color: COLORS.ink,
              letterSpacing: "0.04em",
              marginBottom: "12px",
            }}
          >
            {loadingMsg}
          </p>
          <GuideSkeleton />
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
          <p style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, color: "var(--danger)", marginBottom: "6px", fontSize: "15px" }}>
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
          {shareMsg && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
              {shareMsg}
            </p>
          )}
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: "var(--text)", lineHeight: 1.45, marginBottom: "14px" }}>
            {detail.overview}
          </p>

          <SectionTitle>Passo a passo</SectionTitle>
          {(detail.steps || []).map((step, i) => {
            const bd = stepBreakdowns[i];
            return (
              <div
                key={i}
                style={{
                  background: COLORS.surface,
                  border: `2px solid ${COLORS.screenBorder}`,
                  borderRadius: "10px",
                  padding: "10px 12px",
                  marginBottom: "8px",
                }}
              >
                <div className="flex gap-2">
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
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13.5px", color: COLORS.ink }}>
                        {step.title}
                      </div>
                      <button
                        onClick={() => toggleStepBreakdown(i, step)}
                        aria-label={bd && bd.open ? "Recolher detalhamento do passo" : "Detalhar mais este passo"}
                        title={bd && bd.open ? "Recolher detalhamento do passo" : "Detalhar mais este passo"}
                        style={{
                          background: "none",
                          border: `1.5px solid ${COLORS.screenBorder}`,
                          borderRadius: "999px",
                          color: COLORS.ink,
                          cursor: "pointer",
                          padding: "3px",
                          display: "flex",
                          flexShrink: 0,
                        }}
                      >
                        {bd && bd.loading ? (
                          <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} />
                        ) : bd && bd.open && bd.substeps ? (
                          <Minus size={11} />
                        ) : (
                          <Plus size={11} />
                        )}
                      </button>
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.4 }}>
                      {step.detail}
                    </div>
                  </div>
                </div>
                {bd && bd.error && (
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "6px", marginLeft: "30px" }}>
                    {bd.error}
                  </p>
                )}
                {bd && bd.open && bd.substeps && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: "30px" }}>
                    {bd.substeps.map((s, j) => (
                      <li key={j} style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text)", lineHeight: 1.5 }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

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

function SignList({ items, good = false }: { items: string[]; good?: boolean }) {
  const accent = good ? "var(--success)" : "var(--danger)";
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
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text)", lineHeight: 1.4 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}
