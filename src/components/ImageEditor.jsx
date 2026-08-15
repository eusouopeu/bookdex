import { useRef, useState } from "react";
import { Image as ImageIcon, Plus, X } from "lucide-react";
import { COLORS } from "../theme";
import { readAndCompressImage } from "../lib/imageUtils";

const MAX_IMAGES = 4;

/** Imagens anexadas a um item salvo — chip pra abrir/fechar a galeria de miniaturas. */
export default function ImageEditor({ images, onChange }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const list = images || [];

  async function onFilePicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await readAndCompressImage(file);
      onChange([...list, dataUrl]);
    } catch (err) {
      setError(err.message || "Não foi possível adicionar essa imagem.");
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-1"
        aria-label={list.length ? "Ver imagens anexadas" : "Anexar imagem"}
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "10px",
          color: list.length ? "#7A5A00" : COLORS.screenBorder,
          background: list.length ? "rgba(255,201,71,0.22)" : "transparent",
          border: `1.5px ${list.length ? "solid" : "dashed"} ${list.length ? COLORS.gold : COLORS.screenBorder}`,
          borderRadius: "999px",
          padding: "2px 8px",
          marginTop: "9px",
          marginLeft: "6px",
          cursor: "pointer",
        }}
      >
        <ImageIcon size={10} /> {list.length ? `Imagens (${list.length})` : "Anexar imagem"}
      </button>
    );
  }

  return (
    <div style={{ marginTop: "9px" }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center" style={{ flexWrap: "wrap", gap: "6px" }}>
        {list.map((src, i) => (
          <div key={i} style={{ position: "relative", width: "56px", height: "56px", flexShrink: 0 }}>
            <img
              src={src}
              alt={`Anexo ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px", border: `1.5px solid ${COLORS.screenBorder}` }}
            />
            <button
              onClick={() => removeAt(i)}
              aria-label="Remover imagem"
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {list.length < MAX_IMAGES && (
          <button
            onClick={() => fileInput.current && fileInput.current.click()}
            disabled={busy}
            aria-label="Adicionar imagem"
            className="flex items-center justify-center"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "8px",
              border: `1.5px dashed ${COLORS.screenBorder}`,
              background: "transparent",
              color: COLORS.screenBorder,
              cursor: busy ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            <Plus size={18} />
          </button>
        )}
      </div>
      <input ref={fileInput} type="file" accept="image/*" onChange={onFilePicked} style={{ display: "none" }} />
      {error && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "10.5px", color: "var(--danger)", marginTop: "6px" }}>{error}</p>}
      <div className="flex justify-end" style={{ marginTop: "4px" }}>
        <button
          onClick={() => setOpen(false)}
          style={{
            fontFamily: '"Baloo 2", sans-serif',
            fontWeight: 700,
            fontSize: "10.5px",
            color: COLORS.lensBlue,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
