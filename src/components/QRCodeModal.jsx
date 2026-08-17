import { X } from "lucide-react";
import { COLORS } from "../theme";

/** Bottom sheet mostrando o QR code de uma coleção pra outra pessoa escanear. */
export default function QRCodeModal({ title, dataUrl, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          background: COLORS.surface,
          borderTop: `3px solid ${COLORS.screenBorder}`,
          borderRadius: "16px 16px 0 0",
          padding: "16px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "15px", color: COLORS.ink, margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.screenBorder, padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center" style={{ paddingBottom: "6px" }}>
          <div style={{ background: "#fff", padding: "12px", borderRadius: "12px", border: `2px solid ${COLORS.screenBorder}` }}>
            <img src={dataUrl} alt="QR code da coleção" width={240} height={240} style={{ display: "block" }} />
          </div>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "center",
              maxWidth: "280px",
              marginTop: "12px",
            }}
          >
            Peça pra outra pessoa abrir o Bookdex dela, ir em Importar dados → Ler QR code, e apontar a câmera pra este código.
          </p>
        </div>
      </div>
    </div>
  );
}
