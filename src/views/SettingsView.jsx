import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Gauge, Sun, Moon, Bell, BellOff, Flame, Award, Download } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import {
  getApiKey,
  setApiKey,
  getProxyUrl,
  setProxyUrl,
  looksLikeApiKey,
  MODEL,
  getUsageStats,
  resetUsageStats,
} from "../lib/anthropic";
import { ACHIEVEMENTS, computeUnlocked } from "../lib/gamification";

// Preço aproximado do Sonnet (USD por milhão de tokens) só para dar uma ideia de custo.
const PRICE_PER_M_INPUT = 3;
const PRICE_PER_M_OUTPUT = 15;

function estimateCostUSD(usage) {
  return (usage.inputTokens / 1e6) * PRICE_PER_M_INPUT + (usage.outputTokens / 1e6) * PRICE_PER_M_OUTPUT;
}

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

function looksLikeUrl(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SettingsView({
  onBack,
  onCredentialsChanged,
  theme,
  onThemeChange,
  notificationsEnabled,
  onNotificationsChange,
  gamification,
  totalSavedCount,
  prefetchDetailsEnabled,
  onPrefetchDetailsChange,
}) {
  const [key, setKey] = useState("");
  const [proxy, setProxy] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    (async () => {
      setKey(await getApiKey());
      setProxy(await getProxyUrl());
      setUsage(await getUsageStats());
      setLoaded(true);
    })();
  }, []);

  async function handleResetUsage() {
    await resetUsageStats();
    setUsage(await getUsageStats());
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

      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, marginBottom: "4px" }}>
        Configurações
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.45 }}>
        Fora do claude.ai o app fala direto com a API da Anthropic e precisa da sua própria chave. Ela fica só neste
        dispositivo e nunca é enviada para outro lugar.
      </p>

      <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, marginBottom: "8px" }}>
        Aparência
      </h3>
      <div className="flex gap-2" style={{ marginBottom: "16px" }}>
        <button
          onClick={() => onThemeChange && onThemeChange("light")}
          className="flex items-center justify-center gap-1.5"
          style={{
            flex: 1,
            minHeight: "40px",
            borderRadius: "8px",
            border: `2px solid ${COLORS.screenBorder}`,
            background: theme === "light" ? COLORS.screenBorder : "transparent",
            color: theme === "light" ? COLORS.white : COLORS.ink,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: "pointer",
          }}
        >
          <Sun size={15} /> Claro
        </button>
        <button
          onClick={() => onThemeChange && onThemeChange("dark")}
          className="flex items-center justify-center gap-1.5"
          style={{
            flex: 1,
            minHeight: "40px",
            borderRadius: "8px",
            border: `2px solid ${COLORS.screenBorder}`,
            background: theme === "dark" ? COLORS.screenBorder : "transparent",
            color: theme === "dark" ? COLORS.white : COLORS.ink,
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: "pointer",
          }}
        >
          <Moon size={15} /> Escuro
        </button>
      </div>

      <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, marginBottom: "8px" }}>
        Notificações
      </h3>
      <button
        onClick={() => onNotificationsChange && onNotificationsChange(!notificationsEnabled)}
        className="flex items-center gap-2"
        style={{
          width: "100%",
          minHeight: "44px",
          borderRadius: "8px",
          border: `2px solid ${COLORS.screenBorder}`,
          background: "transparent",
          padding: "0 12px",
          cursor: "pointer",
          marginBottom: "16px",
        }}
      >
        {notificationsEnabled ? <Bell size={16} style={{ color: COLORS.ink }} /> : <BellOff size={16} style={{ color: COLORS.ink }} />}
        <span style={{ flex: 1, textAlign: "left", fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: COLORS.ink }}>
          Lembrete diário de revisão pendente
        </span>
        <span
          style={{
            width: "38px",
            height: "22px",
            borderRadius: "999px",
            background: notificationsEnabled ? COLORS.lensBlue : COLORS.screenBorder,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: notificationsEnabled ? "18px" : "2px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s ease",
            }}
          />
        </span>
      </button>

      <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, marginBottom: "8px" }}>
        Guias offline
      </h3>
      <button
        onClick={() => onPrefetchDetailsChange && onPrefetchDetailsChange(!prefetchDetailsEnabled)}
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.4 }}>
        Baixa o guia "Aprofundar" em segundo plano assim que você captura uma técnica, pra ele já estar disponível
        offline depois. Gasta uma chamada extra à API por técnica capturada.
      </p>

      {gamification && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, marginBottom: "8px" }}>
            Progresso
          </h3>
          <div
            className="flex items-center gap-2"
            style={{
              background: "rgba(255,201,71,0.2)",
              border: `2px solid ${COLORS.gold}`,
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "10px",
            }}
          >
            <Flame size={18} style={{ color: "#B5651D", flexShrink: 0 }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12.5px", color: COLORS.ink }}>
              <strong>{gamification.streak || 0}</strong> dia(s) seguido(s) de uso
              {gamification.longestStreak > gamification.streak ? ` · recorde: ${gamification.longestStreak}` : ""}
            </span>
          </div>
          <div className="flex" style={{ flexWrap: "wrap", gap: "6px" }}>
            {ACHIEVEMENTS.map((a) => {
              const unlocked = computeUnlocked(gamification, totalSavedCount || 0).includes(a.id);
              return (
                <div
                  key={a.id}
                  title={a.desc}
                  className="flex items-center gap-1"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "10px",
                    padding: "4px 9px",
                    borderRadius: "999px",
                    border: `1.5px solid ${unlocked ? COLORS.gold : COLORS.screenBorder}`,
                    background: unlocked ? "rgba(255,201,71,0.25)" : "transparent",
                    color: unlocked ? "#7A5A00" : "var(--text-faint)",
                    opacity: unlocked ? 1 : 0.6,
                  }}
                >
                  <Award size={11} /> {a.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.4 }}>
        Crie uma chave em console.anthropic.com → API Keys. Modelo usado: <code>{MODEL}</code>.
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", margin: "6px 0 18px", lineHeight: 1.4 }}>
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
        <div
          style={{
            marginTop: "22px",
            borderTop: `2px solid ${COLORS.screenBorder}`,
            paddingTop: "14px",
          }}
        >
          <div className="flex items-center gap-1.5" style={{ marginBottom: "8px" }}>
            <Gauge size={15} style={{ color: COLORS.ink }} />
            <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, margin: 0 }}>
              Uso da API
            </h3>
          </div>
          {usage.calls === 0 ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)" }}>
              Nenhuma chamada registrada ainda neste aparelho.
            </p>
          ) : (
            <ul
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                color: "var(--text)",
                lineHeight: 1.6,
                margin: "0 0 10px",
                paddingLeft: "18px",
              }}
            >
              <li>{usage.calls} chamada(s) à API</li>
              <li>
                {usage.inputTokens.toLocaleString("pt-BR")} tokens de entrada ·{" "}
                {usage.outputTokens.toLocaleString("pt-BR")} de saída
              </li>
              <li>
                Custo estimado: ~US$ {estimateCostUSD(usage).toFixed(3)}{" "}
                <span style={{ color: "var(--text-muted)" }}>(preço de lista do Sonnet, pode variar)</span>
              </li>
            </ul>
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
