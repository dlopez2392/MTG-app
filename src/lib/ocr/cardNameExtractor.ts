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
 * Preprocess canvas for OCR.
 * @param invert  true = dark text on light background (white/artifact cards)
 *                false = light text on dark background (colored cards)
 */
export function preprocessImageData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  invert = false
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    // Adaptive-ish threshold: lighter threshold helps noisy photos
    let val = gray > 128 ? 255 : 0;
    if (invert) val = val === 0 ? 255 : 0;

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
}
