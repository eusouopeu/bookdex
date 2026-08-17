/**
 * Sincronização rápida via QR code entre dois aparelhos, sem servidor:
 * o mesmo payload usado no export/import de coleções (ver importer.js) é
 * codificado num QR code que a outra pessoa escaneia direto na câmera.
 *
 * QR codes têm capacidade limitada — um payload grande demais fica ilegível
 * ou nem cabe. Coleções maiores continuam disponíveis via export de arquivo
 * (ShareButton/CollectionsSection), este caminho é só pro caso rápido.
 */
import QRCode from "qrcode";

export const QR_MAX_CHARS = 1800;

export function fitsInQr(text) {
  return (text || "").length <= QR_MAX_CHARS;
}

export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: "M" });
}

export function isBarcodeDetectionSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}
