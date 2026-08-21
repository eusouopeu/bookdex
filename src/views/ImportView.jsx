import { useRef, useState } from "react";
import { ArrowLeft, FileJson, ClipboardPaste, Download, BookOpenText, Layers, FileText, QrCode } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { COLORS, primaryButtonStyle } from "../theme";
import { parsePayload, buildExportPayload, mergeData, mergeCollections } from "../lib/importer";
import { setJSON, KEYS } from "../lib/storage";
import { buildPokedexPdf } from "../lib/pdfExport";
import { buildAnkiCsv, countAnkiRows } from "../lib/ankiExport";
import { buildPokedexMarkdown, countMarkdownItems } from "../lib/markdownExport";
import { shareOrDownloadFile } from "../lib/share";
import QRScanner from "../components/QRScanner";
import { useData } from "../state/DataContext";

export default function ImportView({ onBack }) {
  const { saved, detailCache, collections, applyImport } = useData();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState(null); // { payload, stats } aguardando confirmação
  const [backupMsg, setBackupMsg] = useState(null);
  const [pdfMsg, setPdfMsg] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [ankiMsg, setAnkiMsg] = useState(null);
  const [generatingAnki, setGeneratingAnki] = useState(false);
  const [mdMsg, setMdMsg] = useState(null);
  const [generatingMd, setGeneratingMd] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileInput = useRef(null);
  const hasSaved = Object.keys(saved || {}).length > 0;

  function preview(rawText) {
    setError(null);
    setSummary(null);
    setPending(null);
    try {
      const payload = parsePayload(rawText);
      const { stats } = mergeData(saved, detailCache, payload);
      const { stats: collectionStats } = mergeCollections(collections, payload.collections);
      setPending({ payload, stats: { ...stats, ...collectionStats } });
    } catch (e) {
      setError(e.message || "Não foi possível ler esses dados.");
    }
  }

  function confirmImport() {
    if (!pending) return;
    const stats = applyImport(pending.payload);
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

  function onQrScanned(decodedText) {
    setScanning(false);
    setText(decodedText);
    preview(decodedText);
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

  async function exportPdf() {
    setPdfMsg(null);
    setGeneratingPdf(true);
    try {
      const doc = buildPokedexPdf(saved, detailCache);
      const fileName = "bookdex-pokedex.pdf";
      if (Capacitor.isNativePlatform()) {
        const base64 = doc.output("datauristring").split(",")[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        setPdfMsg(`Salvo em Documentos/${fileName}.`);
      } else {
        doc.save(fileName);
        setPdfMsg("Download iniciado.");
      }
    } catch (e) {
      setPdfMsg(`Falha ao gerar o PDF: ${e.message || e}`);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function exportAnki() {
    setAnkiMsg(null);
    setGeneratingAnki(true);
    try {
      const csv = buildAnkiCsv(saved, detailCache);
      const fileName = "bookdex-anki.csv";
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        setAnkiMsg(`Salvo em Documentos/${fileName}. Importe em Anki → Arquivo → Importar.`);
      } else {
        const outcome = await shareOrDownloadFile(fileName, csv, "text/csv", "Bookdex — export Anki");
        setAnkiMsg(
          outcome === "shared"
            ? "Compartilhado."
            : "Download iniciado. Importe em Anki → Arquivo → Importar."
        );
      }
    } catch (e) {
      setAnkiMsg(`Falha ao gerar o CSV: ${e.message || e}`);
    } finally {
      setGeneratingAnki(false);
    }
  }

  async function exportMarkdown() {
    setMdMsg(null);
    setGeneratingMd(true);
    try {
      const md = buildPokedexMarkdown(saved, detailCache);
      const fileName = "bookdex-pokedex.md";
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data: md,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        setMdMsg(`Salvo em Documentos/${fileName}.`);
      } else {
        const outcome = await shareOrDownloadFile(fileName, md, "text/markdown", "Bookdex — export Markdown");
        setMdMsg(outcome === "shared" ? "Compartilhado." : "Download iniciado.");
      }
    } catch (e) {
      setMdMsg(`Falha ao gerar o Markdown: ${e.message || e}`);
    } finally {
      setGeneratingMd(false);
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
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px", lineHeight: 1.45 }}>
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
          background: COLORS.surface,
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

      <button
        onClick={() => setScanning(true)}
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
        <QrCode size={16} /> Ler QR code
      </button>
      {scanning && <QRScanner onScanned={onQrScanned} onClose={() => setScanning(false)} />}

      {error && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "var(--danger)", marginTop: "12px", lineHeight: 1.4 }}>
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
              color: "var(--text)",
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
            {!!(pending.stats.newCollections || pending.stats.updatedCollections) && (
              <li>
                {pending.stats.newCollections} coleção(ões) nova(s), {pending.stats.updatedCollections} coleção(ões) com itens
                adicionados
              </li>
            )}
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
            background: COLORS.surface,
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
              color: "var(--text)",
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
            {!!(summary.newCollections || summary.updatedCollections) && (
              <li>
                {summary.newCollections} coleção(ões) nova(s), {summary.updatedCollections} coleção(ões) com itens adicionados
              </li>
            )}
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
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "8px" }}>{backupMsg}</p>
        )}

        <button
          onClick={exportPdf}
          disabled={!hasSaved || generatingPdf}
          className="flex items-center justify-center gap-1.5"
          style={{
            ...primaryButtonStyle,
            width: "100%",
            marginTop: "10px",
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
            opacity: !hasSaved || generatingPdf ? 0.55 : 1,
          }}
        >
          <BookOpenText size={16} /> {generatingPdf ? "Gerando PDF..." : "Exportar Pokédex em PDF"}
        </button>
        {!hasSaved && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
            Capture algo antes de exportar o livro em PDF.
          </p>
        )}
        {pdfMsg && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "8px" }}>{pdfMsg}</p>
        )}

        <button
          onClick={exportAnki}
          disabled={!hasSaved || generatingAnki}
          className="flex items-center justify-center gap-1.5"
          style={{
            ...primaryButtonStyle,
            width: "100%",
            marginTop: "10px",
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
            opacity: !hasSaved || generatingAnki ? 0.55 : 1,
          }}
        >
          <Layers size={16} /> {generatingAnki ? "Gerando CSV..." : `Exportar para Anki (${countAnkiRows(saved)} cartões)`}
        </button>
        {ankiMsg && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "8px" }}>{ankiMsg}</p>
        )}

        <button
          onClick={exportMarkdown}
          disabled={!hasSaved || generatingMd}
          className="flex items-center justify-center gap-1.5"
          style={{
            ...primaryButtonStyle,
            width: "100%",
            marginTop: "10px",
            background: "transparent",
            color: COLORS.ink,
            border: `2px solid ${COLORS.screenBorder}`,
            opacity: !hasSaved || generatingMd ? 0.55 : 1,
          }}
        >
          <FileText size={16} /> {generatingMd ? "Gerando Markdown..." : `Exportar em Markdown (${countMarkdownItems(saved)} itens)`}
        </button>
        {mdMsg && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "8px" }}>{mdMsg}</p>
        )}
      </div>
    </div>
  );
}
