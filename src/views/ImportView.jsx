import { useRef, useState } from "react";
import { ArrowLeft, FileJson, ClipboardPaste, Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { COLORS, primaryButtonStyle } from "../theme";
import { parsePayload, buildExportPayload, mergeData } from "../lib/importer";
import { setJSON, KEYS } from "../lib/storage";

export default function ImportView({ onBack, onImport, saved, detailCache }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState(null); // { payload, stats } aguardando confirmação
  const [backupMsg, setBackupMsg] = useState(null);
  const fileInput = useRef(null);

  function preview(rawText) {
    setError(null);
    setSummary(null);
    setPending(null);
    try {
      const payload = parsePayload(rawText);
      const { stats } = mergeData(saved, detailCache, payload);
      setPending({ payload, stats });
    } catch (e) {
      setError(e.message || "Não foi possível ler esses dados.");
    }
  }

  function confirmImport() {
    if (!pending) return;
    const stats = onImport(pending.payload);
    setSummary(stats);
    setPending(null);
    setText("");
  }

  function cancelImport() {
    setPending(null);
  }

  function onFilePicked(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setText(content);
      preview(content);
    };
    reader.onerror = () => setError("Não foi possível ler o arquivo selecionado.");
    reader.readAsText(file);
    e.target.value = "";
  }

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip) {
        setError("A área de transferência está vazia.");
        return;
      }
      setText(clip);
      setError(null);
    } catch {
      setError("O sistema não liberou a área de transferência. Cole o texto manualmente no campo acima.");
    }
  }

  async function saveBackup() {
    const payload = JSON.stringify(buildExportPayload(saved, detailCache), null, 2);
    const fileName = "tecnicadex-backup.json";
    setBackupMsg(null);
    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data: payload,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        setBackupMsg(`Salvo em Documentos/${fileName}.`);
      } else {
        const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setBackupMsg("Download iniciado.");
      }
      await setJSON(KEYS.lastBackup, Date.now());
    } catch (e) {
      setBackupMsg(`Falha ao salvar o backup: ${e.message || e}`);
    }
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

      <h2 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "18px", color: COLORS.ink, marginBottom: "4px" }}>
        Importar dados
      </h2>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#4a5540", marginBottom: "14px", lineHeight: 1.45 }}>
        Cole aqui o JSON exportado do Bookdex do claude.ai, ou selecione o arquivo <code>.json</code> baixado. Nada é
        apagado: os dados são mesclados com o que já está neste aparelho.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"saved": { ... }, "detailCache": { ... }}'
        rows={7}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        style={{
          width: "100%",
          borderRadius: "8px",
          border: `2px solid ${COLORS.screenBorder}`,
          padding: "10px 12px",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "11.5px",
          lineHeight: 1.4,
          background: COLORS.white,
          color: COLORS.ink,
          outline: "none",
          resize: "vertical",
        }}
      />

      <div className="flex gap-2" style={{ marginTop: "10px" }}>
        <button onClick={() => preview(text)} disabled={!text.trim()} style={{ ...primaryButtonStyle, flex: 1, opacity: text.trim() ? 1 : 0.55 }}>
          Revisar JSON colado
        </button>
        <button
          onClick={pasteFromClipboard}
          aria-label="Colar da área de transferência"
          style={{
            ...primaryButtonStyle,
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
            padding: "0 14px",
            flexShrink: 0,
          }}
        >
          <ClipboardPaste size={16} />
        </button>
      </div>

      <button
        onClick={() => fileInput.current && fileInput.current.click()}
        className="flex items-center justify-center gap-1.5"
        style={{
          ...primaryButtonStyle,
          width: "100%",
          marginTop: "8px",
          background: "transparent",
          color: COLORS.ink,
          border: `2px solid ${COLORS.screenBorder}`,
        }}
      >
        <FileJson size={16} /> Selecionar arquivo .json
      </button>
      <input ref={fileInput} type="file" accept="application/json,.json" onChange={onFilePicked} style={{ display: "none" }} />

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#8a1f1f", marginTop: "12px", lineHeight: 1.4 }}>
          {error}
        </p>
      )}

      {pending && (
        <div
          style={{
            marginTop: "14px",
            background: "rgba(255,201,71,0.2)",
            border: `2px solid ${COLORS.gold}`,
            borderRadius: "10px",
            padding: "12px",
          }}
        >
          <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, marginBottom: "6px" }}>
            Confira antes de importar
          </h3>
          <ul
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              color: "#3a3a30",
              lineHeight: 1.6,
              margin: "0 0 12px",
              paddingLeft: "18px",
            }}
          >
            <li>{pending.stats.newSubjects} assunto(s) novo(s)</li>
            <li>{pending.stats.newTechniques} item(ns) será(ão) adicionado(s)</li>
            <li>{pending.stats.updatedTechniques} item(ns) será(ão) atualizado(s) (versão mais recente vence)</li>
            <li>{pending.stats.duplicateTechniques} já existe(m) e será(ão) ignorado(s)</li>
            <li>
              {pending.stats.newDetails} guia(s) novo(s), {pending.stats.duplicateDetails} já em cache
            </li>
          </ul>
          <div className="flex gap-2">
            <button onClick={confirmImport} style={{ ...primaryButtonStyle, flex: 1 }}>
              Confirmar importação
            </button>
            <button
              onClick={cancelImport}
              style={{
                ...primaryButtonStyle,
                background: "transparent",
                color: COLORS.ink,
                border: `2px solid ${COLORS.screenBorder}`,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div
          style={{
            marginTop: "14px",
            background: COLORS.white,
            border: `2px solid ${COLORS.screenBorder}`,
            borderRadius: "10px",
            padding: "12px",
          }}
        >
          <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, marginBottom: "6px" }}>
            Importação concluída
          </h3>
          <ul
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              color: "#3a3a30",
              lineHeight: 1.6,
              margin: 0,
              paddingLeft: "18px",
            }}
          >
            <li>{summary.newSubjects} assunto(s) novo(s)</li>
            <li>{summary.newTechniques} item(ns) novo(s)</li>
            <li>{summary.updatedTechniques} item(ns) atualizado(s) (versão mais recente venceu)</li>
            <li>{summary.duplicateTechniques} já existia(m) e foi(ram) ignorado(s)</li>
            <li>
              {summary.newDetails} guia(s) importado(s), {summary.duplicateDetails} já em cache
            </li>
          </ul>
        </div>
      )}

      <div style={{ marginTop: "22px", borderTop: `2px solid ${COLORS.screenBorder}`, paddingTop: "14px" }}>
        <button
          onClick={saveBackup}
          className="flex items-center justify-center gap-1.5"
          style={{
            ...primaryButtonStyle,
            width: "100%",
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
          }}
        >
          <Download size={16} /> Salvar backup deste aparelho
        </button>
        {backupMsg && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "#5c6b52", marginTop: "8px" }}>{backupMsg}</p>
        )}
      </div>
    </div>
  );
}
