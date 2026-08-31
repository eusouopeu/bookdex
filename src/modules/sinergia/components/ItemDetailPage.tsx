import { useState } from "react";
import { ArrowLeft, Check, GitCompare, HelpCircle, Loader2, Pencil } from "lucide-react";
import { COLORS } from "../../../theme";
import { fetchCriterionEffectExplanation, fetchPersonalDeviationExplanation } from "../lib/effectsApi";
import { MissingApiKeyError } from "../lib/anthropic";
import { costSummary, currentAiEvaluated, currentOriginalRatings, currentRatings, currentRatingMeta, currentExplainCache, currentVariantIndex } from "../lib/effectProfiles";
import EffectRatingBar from "./EffectRatingBar";
import NoteEditor from "./NoteEditor";

const protocolFieldStyle = {
  flex: 1,
  minWidth: 0,
  borderRadius: "6px",
  border: `1.5px solid ${COLORS.screenBorder}`,
  padding: "5px 7px",
  fontFamily: "Inter, sans-serif",
  fontSize: "11px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

/** Protocolo de uso do item: intensidade/dose, frequência, duração, ordem e melhor momento — via IA (DiagnosisPanel) ou editado à mão aqui. */
function ProtocolBlock({ protocol, onSave }: { protocol: any; onSave: (p: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(protocol || { intensity: "", frequency: "", duration: "", order: "", timing: "", reason: "" });

  function startEdit() {
    setDraft(protocol || { intensity: "", frequency: "", duration: "", order: "", timing: "", reason: "" });
    setEditing(true);
  }

  function save() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "10px" }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>Protocolo</span>
        <button
          onClick={editing ? save : startEdit}
          aria-label={editing ? "Salvar protocolo" : "Editar protocolo"}
          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.lensBlue, display: "flex" }}
        >
          {editing ? <Check size={13} /> : <Pencil size={12} />}
        </button>
      </div>
      {!editing && !protocol && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Sem protocolo definido ainda.</p>
      )}
      {!editing && protocol && (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink, marginTop: "4px", lineHeight: 1.6 }}>
          {protocol.intensity && (
            <>
              <strong>Intensidade:</strong> {protocol.intensity}
              <br />
            </>
          )}
          {protocol.frequency && (
            <>
              <strong>Frequência:</strong> {protocol.frequency}
              <br />
            </>
          )}
          {protocol.duration && (
            <>
              <strong>Duração:</strong> {protocol.duration}
              <br />
            </>
          )}
          {protocol.order && (
            <>
              <strong>Ordem:</strong> {protocol.order}
              <br />
            </>
          )}
          {protocol.timing && (
            <>
              <strong>Momento:</strong> {protocol.timing}
            </>
          )}
        </div>
      )}
      {editing && (
        <div style={{ marginTop: "6px" }}>
          <div className="flex items-center gap-2" style={{ marginBottom: "5px" }}>
            <input value={draft.intensity} onChange={(e) => setDraft((d: any) => ({ ...d, intensity: e.target.value }))} placeholder="Intensidade/dose" style={protocolFieldStyle} />
            <input value={draft.frequency} onChange={(e) => setDraft((d: any) => ({ ...d, frequency: e.target.value }))} placeholder="Frequência" style={protocolFieldStyle} />
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: "5px" }}>
            <input value={draft.duration} onChange={(e) => setDraft((d: any) => ({ ...d, duration: e.target.value }))} placeholder="Duração" style={protocolFieldStyle} />
            <input value={draft.order} onChange={(e) => setDraft((d: any) => ({ ...d, order: e.target.value }))} placeholder="Ordem" style={protocolFieldStyle} />
          </div>
          <input value={draft.timing} onChange={(e) => setDraft((d: any) => ({ ...d, timing: e.target.value }))} placeholder="Melhor momento" style={{ ...protocolFieldStyle, width: "100%" }} />
        </div>
      )}
    </div>
  );
}

/**
 * Custo/atrito do item: dinheiro, tempo e esforço. É a coluna que faltava pra
 * decidir entre dois itens de efeito parecido — nenhuma nota -5..+5 captura
 * "custa R$ 200/mês" ou "come 40 minutos do dia". Alimenta a ordenação por
 * custo-benefício na lista do perfil.
 */
function CostBlock({ cost, onSave }: { cost: any; onSave: (c: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cost || { money: "", time: "", effort: "" });

  function startEdit() {
    setDraft(cost || { money: "", time: "", effort: "" });
    setEditing(true);
  }

  function save() {
    const clean = {
      money: Number(String(draft.money).replace(",", ".")) || 0,
      time: Number(String(draft.time).replace(",", ".")) || 0,
      effort: Math.max(0, Math.min(5, Math.round(Number(draft.effort) || 0))),
    };
    onSave(clean.money || clean.time || clean.effort ? clean : null);
    setEditing(false);
  }

  const summary = costSummary({ cost });

  return (
    <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "10px" }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink }}>Custo</span>
        <button
          onClick={editing ? save : startEdit}
          aria-label={editing ? "Salvar custo" : "Editar custo"}
          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.lensBlue, display: "flex" }}
        >
          {editing ? <Check size={13} /> : <Pencil size={12} />}
        </button>
      </div>
      {!editing && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: summary ? COLORS.ink : "var(--text-muted)", marginTop: "4px" }}>
          {summary || "Sem custo registrado — o item entra na ordenação por custo-benefício como se fosse quase de graça."}
        </p>
      )}
      {editing && (
        <div className="flex items-center gap-2" style={{ marginTop: "6px" }}>
          <input
            value={draft.money}
            onChange={(e) => setDraft((d: any) => ({ ...d, money: e.target.value }))}
            inputMode="decimal"
            placeholder="R$/mês"
            style={protocolFieldStyle}
          />
          <input
            value={draft.time}
            onChange={(e) => setDraft((d: any) => ({ ...d, time: e.target.value }))}
            inputMode="decimal"
            placeholder="min/dia"
            style={protocolFieldStyle}
          />
          <input
            value={draft.effort}
            onChange={(e) => setDraft((d: any) => ({ ...d, effort: e.target.value }))}
            inputMode="numeric"
            placeholder="esforço 1-5"
            style={protocolFieldStyle}
          />
        </div>
      )}
    </div>
  );
}

/** Sinais de que o uso do item está indo bem ou precisa de ajuste — só leitura aqui, gerados via "Diagnóstico & planejamento" no perfil. */
function IndicatorsBlock({ indicators }: { indicators: any }) {
  if (!indicators) return null;
  return (
    <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.screenBorder}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "10px" }}>
      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px", color: COLORS.ink, marginBottom: "4px" }}>Indicadores</div>
      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "10.5px", color: "var(--success)" }}>Indo bem</div>
      <ul style={{ margin: "3px 0 6px", paddingLeft: "16px", fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink }}>
        {(indicators.positive || []).map((s: string, i: number) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "10.5px", color: "var(--danger)" }}>Precisa de ajuste</div>
      <ul style={{ margin: "3px 0 0", paddingLeft: "16px", fontFamily: "Inter, sans-serif", fontSize: "11px", color: COLORS.ink }}>
        {(indicators.negative || []).map((s: string, i: number) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

const pillStyle = (active: boolean) => ({
  background: "none",
  border: `1.5px solid ${active ? COLORS.lensBlue : COLORS.screenBorder}`,
  borderRadius: "999px",
  color: active ? COLORS.lensBlue : COLORS.ink,
  fontFamily: "Inter, sans-serif",
  fontSize: "10.5px",
  padding: "3px 9px",
  display: "flex",
  alignItems: "center",
  gap: "4px",
});

/** Uma linha de critério na página do item: medidor + os dois botões de explicação sob demanda. */
function CriterionRow({ criterion, value, original, aiRated, cache, itemLabel, domainContext, onChange, onCache, probability, confidence }: any) {
  const [expandedWhy, setExpandedWhy] = useState(false);
  const [expandedDeviation, setExpandedDeviation] = useState(false);
  const [loadingWhy, setLoadingWhy] = useState(false);
  const [loadingDeviation, setLoadingDeviation] = useState(false);
  const [errorWhy, setErrorWhy] = useState<string | null>(null);
  const [errorDeviation, setErrorDeviation] = useState<string | null>(null);

  const hasDeviation = aiRated && original != null && original !== value;

  async function toggleWhy() {
    if (expandedWhy) {
      setExpandedWhy(false);
      return;
    }
    setExpandedWhy(true);
    if (cache.why) return;
    setErrorWhy(null);
    setLoadingWhy(true);
    try {
      const text = await fetchCriterionEffectExplanation(itemLabel, domainContext, criterion.label, value);
      onCache("why", text);
    } catch (err: any) {
      setErrorWhy(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar agora.");
    } finally {
      setLoadingWhy(false);
    }
  }

  async function toggleDeviation() {
    if (!hasDeviation) return;
    if (expandedDeviation) {
      setExpandedDeviation(false);
      return;
    }
    setExpandedDeviation(true);
    if (cache.deviation) return;
    setErrorDeviation(null);
    setLoadingDeviation(true);
    try {
      const text = await fetchPersonalDeviationExplanation(itemLabel, domainContext, criterion.label, original, value);
      onCache("deviation", text);
    } catch (err: any) {
      setErrorDeviation(err instanceof MissingApiKeyError ? "Configure sua API key em Configurações." : err.message || "Não foi possível gerar agora.");
    } finally {
      setLoadingDeviation(false);
    }
  }

  return (
    <div style={{ borderBottom: `1.5px solid ${COLORS.screenBorder}`, paddingBottom: "10px", marginBottom: "10px" }}>
      <div style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12.5px", color: COLORS.ink, marginBottom: "4px" }}>
        {criterion.label}
      </div>
      {aiRated && <EffectRatingBar label="IA" value={original} probability={probability} confidence={confidence} />}
      <EffectRatingBar label={aiRated ? "Pessoal" : "Valor"} value={value} editable onChange={onChange} probability={probability} confidence={confidence} />
      <div className="flex items-center gap-2" style={{ marginTop: "4px" }}>
        <button onClick={toggleWhy} aria-label={`Por que ${criterion.label} tem essa nota?`} style={{ ...pillStyle(expandedWhy), cursor: "pointer" }}>
          {loadingWhy ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <HelpCircle size={11} />}
          Por quê?
        </button>
        <button
          onClick={toggleDeviation}
          disabled={!hasDeviation}
          aria-label={`Por que minha nota diverge da estimativa da IA em ${criterion.label}?`}
          style={{ ...pillStyle(expandedDeviation), opacity: hasDeviation ? 1 : 0.35, cursor: hasDeviation ? "pointer" : "default" }}
        >
          {loadingDeviation ? <Loader2 size={11} style={{ animation: "spin 0.9s linear infinite" }} /> : <GitCompare size={11} />}
          Minha divergência
        </button>
      </div>
      {expandedWhy && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: errorWhy ? "var(--danger)" : "var(--text)", lineHeight: 1.4, marginTop: "6px" }}>
          {errorWhy || cache.why || (loadingWhy ? "" : "")}
        </p>
      )}
      {expandedDeviation && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: errorDeviation ? "var(--danger)" : "var(--text)", lineHeight: 1.4, marginTop: "6px" }}>
          {errorDeviation || cache.deviation || (loadingDeviation ? "" : "")}
        </p>
      )}
    </div>
  );
}

/**
 * Página cheia de um item: todos os critérios (sem o filtro de tags ocultas
 * do perfil), explicação sob demanda de cada nota e da divergência em
 * relação à IA, variantes (se houver) e a anotação pessoal — que só mora
 * aqui, não no card compacto da view do perfil.
 */
export default function ItemDetailPage({
  item,
  profile,
  onBack,
  onRenameItem,
  onUpdateItemNote,
  onUpdateItemRating,
  onSetItemVariant,
  onCacheItemExplain,
  onSetItemProtocol,
  onSetItemCost,
}: any) {
  const ratings = currentRatings(item);
  const original = currentOriginalRatings(item);
  const aiRated = currentAiEvaluated(item);
  const cache = currentExplainCache(item);
  const meta = currentRatingMeta(item);
  const variantIdx = currentVariantIndex(item);
  const variantSuffix = item.variantLabels && item.variantLabels.length ? ` (${item.variantLabels[variantIdx]})` : "";

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);

  function submitRename() {
    const clean = nameDraft.trim();
    if (clean) onRenameItem(clean);
    else setNameDraft(item.name);
    setRenaming(false);
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
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      {renaming ? (
        <div className="flex items-center gap-2" style={{ marginBottom: "12px" }}>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setNameDraft(item.name);
                setRenaming(false);
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: '"Baloo 2", sans-serif',
              fontWeight: 800,
              fontSize: "16px",
              color: COLORS.ink,
              border: `1.5px solid ${COLORS.screenBorder}`,
              borderRadius: "8px",
              padding: "4px 8px",
              background: COLORS.surface,
              outline: "none",
            }}
          />
          <button onClick={submitRename} aria-label="Salvar nome" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink, flexShrink: 0 }}>
            <Check size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setRenaming(true)}
          className="flex items-center gap-1.5"
          aria-label={`Renomear ${item.name}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "12px", textAlign: "left", minWidth: 0 }}
        >
          <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
            {variantSuffix && <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>{variantSuffix}</span>}
          </h2>
          <Pencil size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </button>
      )}

      {item.variantLabels && item.variantLabels.length > 0 && (
        <div className="flex" style={{ flexWrap: "wrap", gap: "5px", marginBottom: "14px" }}>
          {item.variantLabels.map((label: string, idx: number) => {
            const active = idx === variantIdx;
            return (
              <button
                key={label + idx}
                onClick={() => onSetItemVariant(idx)}
                style={{
                  fontFamily: '"Baloo 2", sans-serif',
                  fontWeight: 700,
                  fontSize: "11px",
                  color: active ? "#4A3300" : COLORS.ink,
                  background: active ? COLORS.gold : "transparent",
                  border: `1.5px solid ${active ? COLORS.gold : COLORS.screenBorder}`,
                  borderRadius: "999px",
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <ProtocolBlock protocol={item.protocol} onSave={onSetItemProtocol} />
      <CostBlock cost={item.cost} onSave={onSetItemCost} />
      <IndicatorsBlock indicators={item.indicators} />

      {profile.criteria.map((c: any) => (
        <CriterionRow
          key={c.id}
          criterion={c}
          value={(ratings as any)[c.id] || 0}
          original={aiRated ? (original as any)[c.id] : undefined}
          aiRated={aiRated}
          cache={(cache as any)[c.id] || {}}
          itemLabel={item.name + variantSuffix}
          domainContext={profile.name}
          onChange={(v: number) => onUpdateItemRating(c.id, v)}
          onCache={(kind: string, text: string) => onCacheItemExplain(c.id, kind, text)}
          probability={(meta as any)[c.id]?.probability}
          confidence={(meta as any)[c.id]?.confidence}
        />
      ))}

      <div style={{ marginTop: "8px" }}>
        <NoteEditor note={item.note} onChange={onUpdateItemNote} />
      </div>
    </div>
  );
}
