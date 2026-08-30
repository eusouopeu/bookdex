import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "../theme";
import { isBarcodeDetectionSupported } from "../lib/qr";

/**
 * Leitor de QR code via câmera, usando a BarcodeDetector API nativa do
 * navegador (sem biblioteca extra de decodificação). Onde não há suporte
 * (ex.: Safari/iOS), avisa e sugere colar o texto/selecionar o arquivo.
 */
export default function QRScanner({ onScanned, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);
  const supported = isBarcodeDetectionSupported();

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let detector;

    function scanLoop() {
      rafRef.current = requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (video && video.readyState >= 2 && detector) {
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && codes[0].rawValue) {
              onScanned(codes[0].rawValue);
              return;
            }
          } catch {
            /* quadro ilegível — tenta de novo no próximo frame */
          }
        }
        if (!cancelled) scanLoop();
      });
    }

    (async () => {
      try {
        // BarcodeDetector ainda não faz parte do lib.dom padrão do TS.
        detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop();
      } catch {
        setError("Não foi possível acessar a câmera. Confira as permissões do navegador pro Bookdex.");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        zIndex: 60,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: "calc(12px + env(safe-area-inset-top)) 14px 12px" }}
      >
        <h3 style={{ fontFamily: '"Baloo 2", sans-serif', fontWeight: 800, fontSize: "14px", color: "#fff", margin: 0 }}>
          Ler QR code
        </h3>
        <button
          onClick={onClose}
          aria-label="Fechar leitor de QR code"
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", cursor: "pointer", color: "#fff", padding: "8px" }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center" style={{ position: "relative", minHeight: 0 }}>
        {supported && !error && (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                width: "220px",
                height: "220px",
                border: `3px solid ${COLORS.gold}`,
                borderRadius: "16px",
                boxShadow: "0 0 0 999px rgba(0,0,0,0.45)",
              }}
            />
          </>
        )}

        {(!supported || error) && (
          <div className="flex flex-col items-center text-center" style={{ padding: "24px", maxWidth: "300px" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#fff", lineHeight: 1.5 }}>
              {error ||
                "Este navegador não suporta leitura de QR code embutida. Peça pra quem compartilhou te mandar o arquivo, ou cole o JSON manualmente."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
