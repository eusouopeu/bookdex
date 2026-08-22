import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Gauge, Sun, Moon, Download, DatabaseZap, Wallet } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import {
  getApiKey,
  setApiKey,
  getProxyUrl,
  setProxyUrl,
  looksLikeApiKey,
  SEARCH_EFFORT_OPTIONS,
} from "../lib/anthropic";
import { MODELS, TIER_LABELS, SEARCH_MODE_TIERS, PRICING } from "../lib/models";
import {
  getUsageStats,
  resetUsageStats,
  getMonthlyBudget,
  setMonthlyBudget,
  costOfByModel,
  totalsOf,
  monthSpend,
} from "../lib/usage";
import { countValid } from "../lib/searchCache";
import { useData } from "../state/DataContext";
import { usePrefs } from "../state/PrefsContext";

const inputStyle = {
  width: "100%",
  borderRadius: "8px",
  border: `2px solid ${COLORS.screenBorder}`,
  padding: "11px 12px",
  minHeight: "44px",
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: "12.5px",
  background: COLORS.surface,
  color: COLORS.ink,
  outline: "none",
};

const sectionTitleStyle = {
  fontFamily: '"Baloo 2", sans-serif',
  fontWeight: 800,
  fontSize: "14px",
  color: COLORS.ink,
  marginBottom: "8px",
};

const hintStyle = {
  fontFamily: "Inter, sans-serif",
  fontSize: "11px",
  color: "var(--text-muted)",
  marginBottom: "16px",
  lineHeight: 1.4,
};

function segmentStyle(active) {
  return {
    flex: 1,
    minHeight: "40px",
    borderRadius: "8px",
    border: `2px solid ${COLORS.screenBorder}`,
    background: active ? COLORS.screenBorder : "transparent",
    color: active ? COLORS.white : COLORS.ink,
    fontFamily: '"Baloo 2", sans-serif',
    fontWeight: 700,
    fontSize: "12.5px",
    cursor: "pointer",
  };
}

function looksLikeUrl(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function usd(value) {
  return `US$ ${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
}

export default function SettingsView({ onBack, onCredentialsChanged, searchCache, onClearSearchCache }) {
  const { prefetchDetailsEnabled, changePrefetchDetails } = useData();
  const { theme, changeTheme, searchEffort, changeSearchEffort, searchTiers, changeSearchTier } = usePrefs();

  const [key, setKey] = useState("");
  const [proxy, setProxy] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [usage, setUsage] = useState(null);
  const [budget, setBudget] = useState(0);
  const [budgetDraft, setBudgetDraft] = useState("");

  useEffect(() => {
    (async () => {
      setKey(await getApiKey());
      setProxy(await getProxyUrl());
      setUsage(await getUsageStats());
      const b = await getMonthlyBudget();
      setBudget(b);
      setBudgetDraft(b ? String(b) : "");
      setLoaded(true);
    })();
  }, []);

  async function handleResetUsage() {
    await resetUsageStats();
    setUsage(await getUsageStats());
  }

  async function saveBudget() {
    const value = Number(String(budgetDraft).replace(",", "."));
    await setMonthlyBudget(value);
    const saved = await getMonthlyBudget();
    setBudget(saved);
    setBudgetDraft(saved ? String(saved) : "");
    setStatus({ ok: true, msg: saved ? `Teto mensal de ${usd(saved)} ativado.` : "Teto mensal desligado." });
  }

  async function save() {
    const trimmed = key.trim();
    const trimmedProxy = proxy.trim();
    if (trimmed && !looksLikeApiKey(trimmed)) {
      setStatus({ ok: false, msg: 'A chave deve começar com "sk-ant-". Confira se colou o valor completo.' });
      return;
    }
    if (trimmedProxy && !looksLikeUrl(trimmedProxy)) {
      setStatus({ ok: false, msg: "A URL do proxy parece inválida. Ela deve começar com http:// ou https://." });
      return;
    }
    await setApiKey(trimmed);
    await setProxyUrl(trimmedProxy);
    setStatus({ ok: true, msg: "Configurações salvas neste dispositivo." });
    onCredentialsChanged();
  }

  async function clearKey() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);
    setKey("");
    await setApiKey("");
    setStatus({ ok: true, msg: "Chave removida deste dispositivo." });
    onCredentialsChanged();
  }

  if (!loaded) return null;

  const totals = usage ? totalsOf(usage.byModel) : null;
  const spentThisMonth = usage ? monthSpend(usage) : 0;
  const cachedCount = countValid(searchCache);

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

      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, marginBottom: "16px" }}>
        Configurações
      </h2>
      <h3 style={sectionTitleStyle}>Aparência</h3>
      <div className="flex gap-2" style={{ marginBottom: "16px" }}>
        <button onClick={() => changeTheme("light")} className="flex items-center justify-center gap-1.5" style={segmentStyle(theme === "light")}>
          <Sun size={15} /> Claro
        </button>
        <button onClick={() => changeTheme("dark")} className="flex items-center justify-center gap-1.5" style={segmentStyle(theme === "dark")}>
          <Moon size={15} /> Escuro
        </button>
      </div>

      <h3 style={sectionTitleStyle}>Guias offline</h3>
      <button
        onClick={() => changePrefetchDetails(!prefetchDetailsEnabled)}
        className="flex items-center gap-2"
        style={{
          width: "100%",
          minHeight: "44px",
          borderRadius: "8px",
          border: `2px solid ${COLORS.screenBorder}`,
          background: "transparent",
          padding: "0 12px",
          cursor: "pointer",
          marginBottom: "6px",
        }}
      >
        <Download size={16} style={{ color: COLORS.ink }} />
        <span style={{ flex: 1, textAlign: "left", fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: COLORS.ink }}>
          Pré-carregar guias ao capturar uma técnica
        </span>
        <span
          style={{
            width: "38px",
            height: "22px",
            borderRadius: "999px",
            background: prefetchDetailsEnabled ? COLORS.lensBlue : COLORS.screenBorder,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: prefetchDetailsEnabled ? "18px" : "2px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s ease",
            }}
          />
        </span>
      </button>
      <p style={hintStyle}>
        Baixa o guia "Aprofundar" em segundo plano assim que você captura uma técnica, pra ele já estar disponível
        offline depois. Gasta uma chamada extra à API por técnica capturada.
      </p>

      <h3 style={sectionTitleStyle}>Esforço de busca</h3>
      <div className="flex gap-2" style={{ marginBottom: "6px" }}>
        {SEARCH_EFFORT_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => changeSearchEffort(opt.value)} style={segmentStyle(searchEffort === opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
      <p style={hintStyle}>
        Controla o capricho das buscas — {SEARCH_EFFORT_OPTIONS.find((o) => o.value === searchEffort)?.hint}. Guias
        ("Aprofundar") continuam sempre no esforço padrão.
      </p>

      <h3 style={sectionTitleStyle}>Modelo por modo de busca</h3>
      <div style={{ marginBottom: "6px" }}>
        {SEARCH_MODE_TIERS.map(({ mode, label }) => (
          <div key={mode} className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
            <span style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: COLORS.ink }}>{label}</span>
            <div className="flex gap-1" style={{ flexShrink: 0 }}>
              {["haiku", "sonnet"].map((tier) => (
                <button
                  key={tier}
                  onClick={() => changeSearchTier(mode, tier)}
                  aria-label={`${label}: usar ${TIER_LABELS[tier]}`}
                  style={{
                    ...segmentStyle(searchTiers[mode] === tier),
                    flex: "none",
                    minWidth: "72px",
                    minHeight: "34px",
                    fontSize: "11.5px",
                  }}
                >
                  {TIER_LABELS[tier]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={hintStyle}>
        Haiku custa cerca de um terço do Sonnet ({usd(PRICING[MODELS.haiku].output)} contra{" "}
        {usd(PRICING[MODELS.sonnet].output)} por milhão de tokens de saída) e dá conta de listas e verbetes; Sonnet
        compensa onde há comparação e julgamento. Guias e os aspectos gerados sob demanda nos cards (planta, técnica,
        conceito) ficam sempre em Sonnet; palavras, sempre em Haiku.
      </p>

      <h3 style={sectionTitleStyle}>Cache de buscas</h3>
      <div
        className="flex items-center gap-2"
        style={{
          border: `2px solid ${COLORS.screenBorder}`,
          borderRadius: "8px",
          padding: "10px 12px",
          marginBottom: "6px",
        }}
      >
        <DatabaseZap size={16} style={{ color: COLORS.ink, flexShrink: 0 }} />
        <span style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: COLORS.ink }}>
          {cachedCount} busca(s) guardada(s)
        </span>
        <button
          onClick={onClearSearchCache}
          disabled={!cachedCount}
          style={{
            ...primaryButtonStyle,
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
            padding: "6px 12px",
            minHeight: "34px",
            fontSize: "11.5px",
            opacity: cachedCount ? 1 : 0.5,
          }}
        >
          Limpar
        </button>
      </div>
      <p style={hintStyle}>
        Repetir uma busca já feita (mesmo termo, critérios, esforço e modelo) devolve o resultado guardado, sem gastar
        chamada. As entradas valem 30 dias, e todo resultado de cache traz o atalho "Refazer busca".
      </p>

      <h3 style={sectionTitleStyle}>Teto mensal de gasto</h3>
      <div className="flex gap-2" style={{ marginBottom: "6px" }}>
        <input
          value={budgetDraft}
          onChange={(e) => setBudgetDraft(e.target.value)}
          inputMode="decimal"
          placeholder="Ex.: 5 (0 ou vazio desliga)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={saveBudget} style={{ ...primaryButtonStyle, flexShrink: 0 }}>
          Aplicar
        </button>
      </div>
      <div className="flex items-center gap-1.5" style={{ marginBottom: "6px" }}>
        <Wallet size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)" }}>
          Este mês: {usd(spentThisMonth)}
          {budget ? ` de ${usd(budget)}` : " (sem teto)"}
        </span>
      </div>
      <label
        style={{
          display: "block",
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "13px",
          color: COLORS.ink,
          marginBottom: "6px",
        }}
      >
        API key da Anthropic
      </label>
      <div className="flex gap-2" style={{ marginBottom: "8px" }}>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          type={reveal ? "text" : "password"}
          placeholder="sk-ant-..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? "Ocultar chave" : "Mostrar chave"}
          style={{
            width: "44px",
            minHeight: "44px",
            borderRadius: "8px",
            border: `2px solid ${COLORS.screenBorder}`,
            background: COLORS.surface,
            color: COLORS.ink,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p style={hintStyle}>
        Crie uma chave em console.anthropic.com → API Keys. Modelos usados: <code>{MODELS.sonnet}</code> e{" "}
        <code>{MODELS.haiku}</code>.
      </p>

      <label
        style={{
          display: "block",
          fontFamily: '"Baloo 2", sans-serif',
          fontWeight: 700,
          fontSize: "13px",
          color: COLORS.ink,
          marginBottom: "6px",
        }}
      >
        Proxy (opcional)
      </label>
      <input
        value={proxy}
        onChange={(e) => setProxy(e.target.value)}
        placeholder="https://seu-worker.workers.dev/v1/messages"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        style={inputStyle}
      />
      <p style={{ ...hintStyle, margin: "6px 0 18px" }}>
        Deixe vazio para falar direto com a API. Preencha só se a chamada direta for bloqueada por CORS — ver README.
      </p>

      <div className="flex gap-2">
        <button onClick={save} style={{ ...primaryButtonStyle, flex: 1 }}>
          Salvar
        </button>
        <button
          onClick={clearKey}
          style={{
            ...primaryButtonStyle,
            background: confirmingClear ? "var(--danger)" : "transparent",
            color: confirmingClear ? COLORS.white : COLORS.ink,
            border: `2px solid ${confirmingClear ? "var(--danger)" : COLORS.screenBorder}`,
          }}
        >
          {confirmingClear ? "Confirmar remoção?" : "Apagar chave"}
        </button>
        {confirmingClear && (
          <button
            onClick={() => setConfirmingClear(false)}
            aria-label="Cancelar remoção da chave"
            style={{
              ...primaryButtonStyle,
              background: "transparent",
              color: COLORS.ink,
              border: `2px solid ${COLORS.screenBorder}`,
              padding: "0 14px",
              flexShrink: 0,
            }}
          >
            Cancelar
          </button>
        )}
      </div>

      {status && (
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: status.ok ? "var(--success)" : "var(--danger)",
            marginTop: "12px",
            lineHeight: 1.4,
          }}
        >
          {status.msg}
        </p>
      )}

      {usage && (
        <div style={{ marginTop: "22px", borderTop: `2px solid ${COLORS.screenBorder}`, paddingTop: "14px" }}>
          <div className="flex items-center gap-1.5" style={{ marginBottom: "8px" }}>
            <Gauge size={15} style={{ color: COLORS.ink }} />
            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Uso da API</h3>
          </div>
          {totals.calls === 0 ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)" }}>
              Nenhuma chamada registrada ainda neste aparelho.
            </p>
          ) : (
            <>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11.5px",
                  color: "var(--text)",
                  marginBottom: "8px",
                }}
              >
                <thead>
                  <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ fontWeight: 400, paddingBottom: "4px" }}>Modelo</th>
                    <th style={{ fontWeight: 400, textAlign: "right" }}>Chamadas</th>
                    <th style={{ fontWeight: 400, textAlign: "right" }}>Tokens (E/S)</th>
                    <th style={{ fontWeight: 400, textAlign: "right" }}>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage.byModel).map(([model, b]) => (
                    <tr key={model} style={{ borderTop: `1px solid ${COLORS.screenBorder}` }}>
                      <td style={{ padding: "5px 0", fontFamily: '"JetBrains Mono", monospace', fontSize: "10.5px" }}>
                        {model === MODELS.sonnet ? "Sonnet" : model === MODELS.haiku ? "Haiku" : model}
                      </td>
                      <td style={{ textAlign: "right" }}>{b.calls}</td>
                      <td style={{ textAlign: "right" }}>
                        {(b.inputTokens || 0).toLocaleString("pt-BR")}/{(b.outputTokens || 0).toLocaleString("pt-BR")}
                      </td>
                      <td style={{ textAlign: "right" }}>{usd(costOfByModel({ [model]: b }))}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${COLORS.screenBorder}`, fontWeight: 600 }}>
                    <td style={{ padding: "5px 0" }}>Total</td>
                    <td style={{ textAlign: "right" }}>{totals.calls}</td>
                    <td style={{ textAlign: "right" }}>
                      {totals.inputTokens.toLocaleString("pt-BR")}/{totals.outputTokens.toLocaleString("pt-BR")}
                    </td>
                    <td style={{ textAlign: "right" }}>{usd(costOfByModel(usage.byModel))}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ ...hintStyle, marginBottom: "10px" }}>
                Preço de lista, pode variar. O contador vale desde{" "}
                {usage.since ? new Date(usage.since).toLocaleDateString("pt-BR") : "a primeira chamada"}.
              </p>
            </>
          )}
          <button
            onClick={handleResetUsage}
            style={{
              ...primaryButtonStyle,
              background: "transparent",
              color: COLORS.ink,
              border: `2px solid ${COLORS.screenBorder}`,
              padding: "8px 14px",
              minHeight: "36px",
              fontSize: "11.5px",
            }}
          >
            Zerar contador
          </button>
        </div>
      )}
    </div>
  );
}
