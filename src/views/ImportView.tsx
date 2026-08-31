import { useRef, useState } from "react";
import { ArrowLeft, FileJson, ClipboardPaste, Download, QrCode } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { COLORS, primaryButtonStyle } from "../theme";
import { parsePayload, buildExportPayload, mergeData, mergeCollections, mergeWords } from "../lib/importer";
import { setJSON, KEYS } from "../lib/storage";
import { buildPokedexPdf } from "../lib/pdfExport";
import { buildAnkiCsv, countAnkiRows } from "../lib/ankiExport";
import { buildPokedexMarkdown, countMarkdownItems } from "../lib/markdownExport";
import { shareOrDownloadFile } from "../lib/share";
import QRScanner from "../components/QRScanner";
import { useData } from "../state/DataContext";
import { groupItems, itemKind, categoryOfKind, withItems, type SavedState } from "../lib/savedModel";

const EXPORT_FORMATS = [
  { id: "pdf", label: "PDF" },
  { id: "markdown", label: "Markdown" },
  { id: "anki", label: "Anki (CSV)" },
];

const EXPORT_SCOPES = [
  { id: "all", label: "Tudo" },
  { id: "technique", label: "Técnicas" },
  { id: "knowledge", label: "Conceitos" },
  { id: "plants", label: "Plantas" },
  { id: "words", label: "Palavras" },
];

/** Filtra `saved` pra só os itens da categoria pedida ("all" não filtra nada). */
function filterSavedByScope(saved: SavedState, scope: string) {
  if (scope === "all" || scope === "words") return saved;
  const out: SavedState = {};
  for (const [key, group] of Object.entries(saved || {})) {
    const items = groupItems(group).filter((it) => categoryOfKind(itemKind(it, group)) === scope);
    if (items.length) out[key] = withItems(group, items);
  }
  return out;
}

export default function ImportView({ onBack }) {
  const { saved, detailCache, collections, words, applyImport } = useData();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState(null); // { payload, stats } aguardando confirmação
  const [backupMsg, setBackupMsg] = useState(null);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportScope, setExportScope] = useState("all");
  const [exportMsg, setExportMsg] = useState(null);
  const [generatingExport, setGeneratingExport] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileInput = useRef(null);

  function preview(rawText) {
    setError(null);
    setSummary(null);
    setPending(null);
    try {
      const payload = parsePayload(rawText);
      const { stats } = mergeData(saved, detailCache, payload);
      const { stats: collectionStats } = mergeCollections(collections, payload.collections);
      const { stats: wordStats } = mergeWords(words, payload.words);
      setPending({ payload, stats: { ...stats, ...collectionStats, ...wordStats } });
    } catch (e) {
      setError(e.message || "Não foi possível ler esses dados.");
    }
  }

  async function confirmImport() {
    if (!pending) return;
    const stats = applyImport(pending.payload);
    let sinergiaImported = 0;
    if (pending.payload.sinergia) {
      const { applyBackup } = await import("../modules/sinergia/lib/backup");
      const result = await applyBackup(pending.payload.sinergia, "mesclar");
      sinergiaImported = result.imported;
    }
    setSummary({ ...stats, sinergiaImported });
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

  /**
   * Backup ÚNICO cross-módulo: além de `saved`/`detailCache`/`collections`/
   * `words` do Cognidex, embute os perfis de efeito do Sinergia sob a chave
   * `sinergia` — um arquivo só cobre os dois módulos (a API key de nenhum
   * dos dois entra: é segredo do aparelho, não dado do usuário).
   */
  async function saveBackup() {
    const { buildBackup: buildSinergiaBackup } = await import("../modules/sinergia/lib/backup");
    const payload = JSON.stringify(
      { ...buildExportPayload(saved, detailCache, collections, words), sinergia: await buildSinergiaBackup() },
      null,
      2
    );
    const fileName = "cognidex-backup.json";
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

  // PDF/Markdown não sabem exportar palavras — só o Anki cobre os dois acervos.
  const availableScopes = exportFormat === "anki" ? EXPORT_SCOPES : EXPORT_SCOPES.filter((s) => s.id !== "words");
  const effectiveScope = availableScopes.some((s) => s.id === exportScope) ? exportScope : "all";

  /**
   * Um export só, com formato × escopo escolhidos na UI, em vez de 4 botões
   * separados espalhados pela tela — cada um sabia gerar um formato só, todos
   * sempre exportando a Pokédex inteira. O escopo filtra `saved` antes de
   * passar pros builders (que já sabem separar por categoria internamente);
   * "Palavras" só faz sentido pro Anki, que é o único formato que já lida com
   * `words`.
   */
  async function runExport() {
    setExportMsg(null);
    setGeneratingExport(true);
    try {
      const scopedSaved = filterSavedByScope(saved, effectiveScope);
      const scopedWords = effectiveScope === "all" || effectiveScope === "words" ? words : {};

      if (exportFormat === "pdf") {
        const doc = buildPokedexPdf(scopedSaved, detailCache);
        const fileName = "cognidex-pokedex.pdf";
        if (Capacitor.isNativePlatform()) {
          const base64 = doc.output("datauristring").split(",")[1];
          await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents, recursive: true });
          setExportMsg(`Salvo em Documentos/${fileName}.`);
        } else {
          doc.save(fileName);
          setExportMsg("Download iniciado.");
        }
        return;
      }
      if (exportFormat === "anki") {
        const csv = buildAnkiCsv(scopedSaved, detailCache, scopedWords);
        await saveOrDownload("cognidex-anki.csv", csv, "text/csv", Encoding.UTF8, "Cognidex — export Anki", "Importe em Anki → Arquivo → Importar.");
        return;
      }
      const md = buildPokedexMarkdown(scopedSaved, detailCache);
      await saveOrDownload("cognidex-pokedex.md", md, "text/markdown", Encoding.UTF8, "Cognidex — export Markdown");
    } catch (e) {
      setExportMsg(`Falha ao exportar: ${e.message || e}`);
    } finally {
      setGeneratingExport(false);
    }
  }

  async function saveOrDownload(fileName, content, mime, encoding, shareTitle, nativeSuffix = "") {
    if (Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({ path: fileName, data: content, directory: Directory.Documents, encoding, recursive: true });
      setExportMsg(`Salvo em Documentos/${fileName}.${nativeSuffix ? ` ${nativeSuffix}` : ""}`);
    } else {
      const outcome = await shareOrDownloadFile(fileName, content, mime, shareTitle);
      setExportMsg(outcome === "shared" ? "Compartilhado." : `Download iniciado.${nativeSuffix ? ` ${nativeSuffix}` : ""}`);
    }
  }

  const scopeCount =
    effectiveScope === "words"
      ? Object.values(words || {}).reduce((sum, g) => sum + (g.words || []).length, 0)
      : exportFormat === "anki"
        ? countAnkiRows(filterSavedByScope(saved, effectiveScope), effectiveScope === "all" ? words : {})
        : countMarkdownItems(filterSavedByScope(saved, effectiveScope));
  const exportDisabled = generatingExport || scopeCount === 0;

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
        Cole aqui o JSON exportado do Cognidex do claude.ai, ou selecione o arquivo <code>.json</code> baixado. Nada é
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
            {!!(pending.stats.newWords || pending.stats.updatedWords) && (
              <li>
                {pending.stats.newWords} palavra(s) nova(s), {pending.stats.updatedWords} atualizada(s)
              </li>
            )}
            {!!pending.payload.sinergia && <li>perfis de efeito do Sinergia também serão mesclados</li>}
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
            {!!(summary.newWords || summary.updatedWords) && (
              <li>
                {summary.newWords} palavra(s) nova(s), {summary.updatedWords} atualizada(s)
              </li>
            )}
            {!!summary.sinergiaImported && <li>{summary.sinergiaImported} perfil(is) de efeito importado(s) no Sinergia</li>}
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

        <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: COLORS.ink, margin: "18px 0 8px" }}>
          Exportar
        </h3>

        <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setExportFormat(f.id)}
              style={{
                flex: "1 1 auto",
                padding: "7px 10px",
                borderRadius: "999px",
                border: `1.5px solid ${exportFormat === f.id ? COLORS.lensBlue : COLORS.screenBorder}`,
                background: exportFormat === f.id ? COLORS.lensBlue : "transparent",
                color: exportFormat === f.id ? "#fff" : COLORS.ink,
                fontFamily: '"Baloo 2", sans-serif',
                fontWeight: 700,
                fontSize: "11.5px",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {availableScopes.map((s) => (
            <button
              key={s.id}
              onClick={() => setExportScope(s.id)}
              style={{
                padding: "4px 9px",
                borderRadius: "999px",
                border: `1.5px solid ${COLORS.screenBorder}`,
                background: effectiveScope === s.id ? COLORS.screenBorder : "transparent",
                color: effectiveScope === s.id ? "#fff" : COLORS.screenBorder,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "10.5px",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={runExport}
          disabled={exportDisabled}
          className="flex items-center justify-center gap-1.5"
          style={{ ...primaryButtonStyle, width: "100%", opacity: exportDisabled ? 0.55 : 1 }}
        >
          <Download size={16} />
          {generatingExport ? "Gerando..." : `Exportar (${scopeCount} ${effectiveScope === "words" ? "palavra(s)" : "item(ns)"})`}
        </button>
        {exportMsg && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "8px" }}>{exportMsg}</p>
        )}
      </div>
    </div>
  );
}
