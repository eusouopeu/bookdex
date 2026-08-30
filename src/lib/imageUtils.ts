/**
 * Compressão de imagens anexadas a itens salvos: redimensiona pro maior lado
 * caber em MAX_DIM e reexporta em JPEG, pra não estourar o storage local
 * (Preferences/localStorage) com fotos em resolução original.
 */
const MAX_DIM = 900;
const JPEG_QUALITY = 0.72;

export function readAndCompressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
