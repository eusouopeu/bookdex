import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Download, Eye, EyeOff, Gauge, Sun, Moon, Upload, Wallet, Zap } from "lucide-react";
import { COLORS, primaryButtonStyle } from "../../../theme";
import { getApiKey, setApiKey, getProxyUrl, setProxyUrl, looksLikeApiKey, getThinkingMode, setThinkingMode } from "../lib/anthropic";
import { MODELS } from "../lib/models";
import { getUsageStats, resetUsageStats, getMonthlyBudget, setMonthlyBudget, costOfByModel, totalsOf, monthSpend } from "../lib/usage";
import { buildBackup, downloadBackup, parseBackupFile, applyBackup, IMPORT_MODES } from "../lib/backup";
import { clearRatingCache, ratingCacheSize } from "../lib/ratingCache";

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

function segmentStyle(active: boolean) {
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

function looksLikeUrl(url?: string) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function usd(value: number) {
  return `US$ ${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
}

export default function SettingsView({
  onBack,
  onCredentialsChanged,
  theme,
  onChangeTheme,
}: {
  onBack: () => void;
  onCredentialsChanged: () => void;
  theme: string;
  onChangeTheme: (theme: string) => void;
}) {
  const [key, setKey] = useState("");
  const [proxy, setProxy] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [budget, setBudget] = useState(0);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [thinkingMode, setThinkingModeState] = useState("auto");
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmingImport, setConfirmingImport] = useState<any>(null);
  const [cacheSize, setCacheSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setKey(await getApiKey());
      setProxy(await getProxyUrl());
      setUsage(await getUsageStats());
      setThinkingModeState(await getThinkingMode());
      setCacheSize(await ratingCacheSize());
      const b = await getMonthlyBudget();
      setBudget(b);
      setBudgetDraft(b ? String(b) : "");
      setLoaded(true);
    })();
  }, []);

  async function changeThinkingMode(mode: string) {
    setThinkingModeState(mode);
    await setThinkingMode(mode);
  }

  async function handleExportBackup() {
    const backup = await buildBackup();
    downloadBackup(backup);
    setBackupStatus({ ok: true, msg: `Backup exportado com ${Object.keys(backup.effectProfiles).length} perfil(is).` });
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseBackupFile(String(reader.result));
        setConfirmingImport(data);
        setBackupStatus(null);
      } catch (err: any) {
        setBackupStatus({ ok: false, msg: err.message || "Não foi possível ler esse arquivo." });
      }
    };
    reader.onerror = () => setBackupStatus({ ok: false, msg: "Não foi possível ler esse arquivo." });
    reader.readAsText(file);
  }

  async function confirmImport(mode: string) {
    if (!confirmingImport) return;
    await applyBackup(confirmingImport, mode);
    window.location.reload();
  }

  async function handleClearRatingCache() {
    await clearRatingCache();
    setCacheSize(0);
    setBackupStatus({ ok: true, msg: "Cache de avaliações limpo." });
  }

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
        <button onClick={() => onChangeTheme("light")} className="flex items-center justify-center gap-1.5" style={segmentStyle(theme === "light")}>
          <Sun size={15} /> Claro
        </button>
        <button onClick={() => onChangeTheme("dark")} className="flex items-center justify-center gap-1.5" style={segmentStyle(theme === "dark")}>
          <Moon size={15} /> Escuro
        </button>
      </div>

      <h3 style={sectionTitleStyle}>Modo de resposta da IA</h3>
      <div className="flex gap-2" style={{ marginBottom: "6px" }}>
        <button onClick={() => changeThinkingMode("auto")} className="flex items-center justify-center gap-1.5" style={segmentStyle(thinkingMode === "auto")}>
          Padrão
        </button>
        <button onClick={() => changeThinkingMode("fast")} className="flex items-center justify-center gap-1.5" style={segmentStyle(thinkingMode === "fast")}>
          <Zap size={14} /> Rápido
        </button>
      </div>
      <p style={hintStyle}>
        "Padrão" usa pensamento estendido (mais criterioso, mais lento e mais caro). "Rápido" usa o mesmo modelo
        (Sonnet) sem pensamento estendido — respostas mais rápidas e mais baratas.
      </p>

      <h3 style={sectionTitleStyle}>Backup</h3>
      <div className="flex gap-2" style={{ marginBottom: "6px" }}>
        <button onClick={handleExportBackup} className="flex items-center justify-center gap-1.5" style={{ ...primaryButtonStyle, flex: 1 }}>
          <Download size={14} /> Exportar
        </button>
        <button
          onClick={handleImportClick}
          className="flex items-center justify-center gap-1.5"
          style={{ ...primaryButtonStyle, flex: 1, background: "transparent", color: COLORS.ink, border: `2px solid ${COLORS.screenBorder}` }}
        >
          <Upload size={14} /> Importar
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: "none" }} />
      </div>
      {confirmingImport && (
        <div style={{ background: "rgba(255,201,71,0.15)", border: `2px solid ${COLORS.gold}`, borderRadius: "8px", padding: "9px 10px", marginBottom: "8px" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: COLORS.ink, marginBottom: "8px", lineHeight: 1.4 }}>
            {Object.keys(confirmingImport.effectProfiles).length} perfil(is) no arquivo (
            {confirmingImport.exportedAt ? new Date(confirmingImport.exportedAt).toLocaleDateString("pt-BR") : "data desconhecida"}). Como quer trazê-los?
          </p>
          {IMPORT_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => confirmImport(m.key)}
              className="flex items-center justify-between gap-2"
              style={{
                ...primaryButtonStyle,
                width: "100%",
                marginBottom: "6px",
                minHeight: "38px",
                fontSize: "11.5px",
                background: m.key === "substituir" ? "var(--danger)" : m.key === "mesclar" ? COLORS.lensBlue : "transparent",
                color: m.key === "duplicar" ? COLORS.ink : COLORS.white,
                border: m.key === "duplicar" ? `2px solid ${COLORS.screenBorder}` : "none",
              }}
            >
              <span>{m.label}</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "10.5px", opacity: 0.9, textAlign: "right" }}>{m.hint}</span>
            </button>
          ))}
          <button
            onClick={() => setConfirmingImport(null)}
            style={{ ...primaryButtonStyle, width: "100%", background: "transparent", color: COLORS.ink, border: `2px solid ${COLORS.screenBorder}`, minHeight: "36px", fontSize: "11.5px" }}
          >
            Cancelar
          </button>
        </div>
      )}
      {backupStatus && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: backupStatus.ok ? "var(--success)" : "var(--danger)", marginBottom: "10px", lineHeight: 1.4 }}>
          {backupStatus.msg}
        </p>
      )}
      <p style={hintStyle}>
        O backup inclui perfis, itens e notas. A API key NUNCA entra no backup — configure-a de novo em cada aparelho.
        Para exportar um perfil só, use "Exportar" dentro do perfil, aba Outros.
      </p>

      <h3 style={sectionTitleStyle}>Cache de avaliações</h3>
      <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
        <span style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)" }}>
          {cacheSize} estimativa(s) guardada(s)
        </span>
        <button
          onClick={handleClearRatingCache}
          style={{ ...primaryButtonStyle, background: "transparent", color: COLORS.ink, border: `2px solid ${COLORS.screenBorder}`, padding: "8px 14px", minHeight: "36px", fontSize: "11.5px", flexShrink: 0 }}
        >
          Limpar cache
        </button>
      </div>
      <p style={hintStyle}>
        Cada par (item, critério) já avaliado é reaproveitado em todos os perfis, sem gastar chamada de novo. Limpe se quiser
        reavaliar tudo do zero.
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
      <div className="flex items-center gap-1.5" style={{ marginBottom: "16px" }}>
        <Wallet size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)" }}>
          Este mês: {usd(spentThisMonth)}
          {budget ? ` de ${usd(budget)}` : " (sem teto)"}
        </span>
      </div>

      <label style={{ display: "block", fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13px", color: COLORS.ink, marginBottom: "6px" }}>
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
        Crie uma chave em console.anthropic.com → API Keys. Modelo usado: <code>{MODELS.sonnet}</code>.
      </p>

      <label style={{ display: "block", fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "13px", color: COLORS.ink, marginBottom: "6px" }}>
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
        Deixe vazio para falar direto com a API. Preencha só se a chamada direta for bloqueada por CORS.
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
            style={{ ...primaryButtonStyle, background: "transparent", color: COLORS.ink, border: `2px solid ${COLORS.screenBorder}`, padding: "0 14px", flexShrink: 0 }}
          >
            Cancelar
          </button>
        )}
      </div>

      {status && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: status.ok ? "var(--success)" : "var(--danger)", marginTop: "12px", lineHeight: 1.4 }}>
          {status.msg}
        </p>
      )}

      {usage && (
        <div style={{ marginTop: "22px", borderTop: `2px solid ${COLORS.screenBorder}`, paddingTop: "14px" }}>
          <div className="flex items-center gap-1.5" style={{ marginBottom: "8px" }}>
            <Gauge size={15} style={{ color: COLORS.ink }} />
            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Uso da API</h3>
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px", lineHeight: 1.45 }}>
            {totals!.calls === 0
              ? "Nenhuma chamada registrada ainda neste aparelho."
              : `${totals!.calls} chamada(s), ${usd(costOfByModel(usage.byModel))} nesta contagem.`}{" "}
            O detalhamento por modelo, cruzado com o Cognidex, fica em Configurações → Uso da API (todos os módulos).
          </p>
          <button
            onClick={handleResetUsage}
            style={{ ...primaryButtonStyle, background: "transparent", color: COLORS.ink, border: `2px solid ${COLORS.screenBorder}`, padding: "8px 14px", minHeight: "36px", fontSize: "11.5px" }}
          >
            Zerar contador
          </button>
        </div>
      )}
    </div>
  );
}
