/**
 * Clean and normalize OCR output from a card title bar.
 */
export function cleanOcrText(raw: string): string {
  let text = raw.trim();

  // Common OCR misreads
  text = text
    .replace(/[|]/g, "l")
    .replace(/1(?=[a-z])/gi, "l")   // "1ightning" → "lightning"
    .replace(/0(?=[a-z])/gi, "o")   // "0f" → "of"
    .replace(/\{[^}]*\}/g, "")      // strip mana cost symbols
    .replace(/[^a-zA-Z0-9\s\-',.\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Normalise split card slash
  text = text.replace(/\s*\/\s*/g, " // ").replace(/\/\/ \/\//g, "//");

  if (text.length < 2) return "";
  return text;
}

/**
 * Convert canvas to grayscale with optional contrast boost.
 * Does NOT threshold — lets Tesseract's own binarization handle it.
 */
export function grayscaleEnhance(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  contrastFactor = 1.4
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Contrast stretch around midpoint 128
    gray = Math.min(255, Math.max(0, (gray - 128) * contrastFactor + 128));
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Preprocess canvas for OCR via hard binarization.
 * @param invert  true = dark text on light background (white/artifact cards)
 *                false = light text on dark background (colored cards)
 * @param threshold  binarization threshold (default 128)
 */
export function preprocessImageData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  invert = false,
  threshold = 128
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    let val = gray > threshold ? 255 : 0;
    if (invert) val = val === 0 ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
}
