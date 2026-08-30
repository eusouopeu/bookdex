import { useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { COLORS } from "../theme";
import { readAndCompressImage } from "../lib/imageUtils";

/**
 * A foto do topo de um card de planta, sempre no mesmo tamanho (`HEIGHT`), pra
 * que uma lista de plantas tenha cards do mesmo formato independentemente do
 * enquadramento de cada foto — daí o `object-fit: cover`.
 *
 * Quando a planta entrou por nome e ainda não tem foto, o mesmo espaço vira o
 * botão de anexar: a moldura não muda de altura ao ganhar a foto, então nada
 * salta na tela.
 */
const HEIGHT = 170;

interface PlantPhotoProps {
  images?: string[];
  onChange?: (images: string[]) => void;
  capture?: "environment" | "user" | boolean;
}

export default function PlantPhoto({ images, onChange, capture = "environment" }: PlantPhotoProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const list = images || [];
  const editable = !!onChange;

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange?.([...list, await readAndCompressImage(file)]);
    } catch (err: any) {
      setError(err.message || "Não foi possível usar essa foto.");
    } finally {
      setBusy(false);
    }
  }

  const frame: CSSProperties = {
    width: "100%",
    height: `${HEIGHT}px`,
    borderRadius: "8px",
    marginBottom: "10px",
    overflow: "hidden",
    position: "relative",
    background: "rgba(0,0,0,0.04)",
  };

  if (!list.length) {
    if (!editable) return null;
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => fileInput.current && fileInput.current.click()}
          disabled={busy}
          className="flex flex-col items-center justify-center gap-1.5"
          style={{
            ...frame,
            border: `2px dashed ${COLORS.screenBorder}`,
            color: COLORS.screenBorder,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? <Loader2 size={22} style={{ animation: "spin 0.9s linear infinite" }} /> : <Camera size={22} />}
          <span style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 700, fontSize: "12px" }}>
            {busy ? "Preparando foto..." : "Anexar foto da planta"}
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture={capture}
          onChange={onFilePicked}
          style={{ display: "none" }}
        />
        {error && (
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "var(--danger)", marginTop: "-4px", marginBottom: "8px" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div style={{ ...frame, border: `2px solid ${COLORS.screenBorder}` }}>
        <img src={list[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {editable && (
          <button
            onClick={() => onChange?.(list.slice(1))}
            aria-label="Remover foto da planta"
            title="Remover foto"
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              border: "none",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        )}
        {list.length > 1 && (
          <span
            style={{
              position: "absolute",
              bottom: "6px",
              right: "6px",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              borderRadius: "999px",
              padding: "2px 8px",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "10px",
            }}
          >
            +{list.length - 1}
          </span>
        )}
      </div>
    </div>
  );
}
