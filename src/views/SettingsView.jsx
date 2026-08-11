import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../theme";
import { getApiKey, setApiKey, getProxyUrl, setProxyUrl, looksLikeApiKey, MODEL } from "../lib/anthropic";

const inputStyle = {
  width: "100%",
  borderRadius: "8px",
  border: `2px solid ${COLORS.screenBorder}`,
  padding: "11px 12px",
  minHeight: "44px",
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: "12.5px",
  background: COLORS.white,
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

export default function SettingsView({ onBack, onCredentialsChanged }) {
  const [key, setKey] = useState("");
  const [proxy, setProxy] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    (async () => {
      setKey(await getApiKey());
      setProxy(await getProxyUrl());
      setLoaded(true);
    })();
  }, []);

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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#4a5540", marginBottom: "16px", lineHeight: 1.45 }}>
        Fora do claude.ai o app fala direto com a API da Anthropic e precisa da sua própria chave. Ela fica só neste
        dispositivo e nunca é enviada para outro lugar.
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
            background: COLORS.white,
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#5c6b52", marginBottom: "16px", lineHeight: 1.4 }}>
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#5c6b52", margin: "6px 0 18px", lineHeight: 1.4 }}>
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
            background: confirmingClear ? "#8a1f1f" : "transparent",
            color: confirmingClear ? COLORS.white : COLORS.ink,
            border: `2px solid ${confirmingClear ? "#8a1f1f" : COLORS.screenBorder}`,
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
            color: status.ok ? "#2E7D32" : "#8a1f1f",
            marginTop: "12px",
            lineHeight: 1.4,
          }}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}
