/**
 * Clean and normalize OCR output from a card title bar
 * to produce a usable search query for Scryfall.
 */
export function cleanOcrText(raw: string): string {
  let text = raw.trim();

  // Replace common OCR misreads
  text = text
    .replace(/[|]/g, "l")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/`/g, "'")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");

  // Remove mana cost symbols that might appear at the end (e.g., {2}{R})
  text = text.replace(/\{[^}]*\}/g, "").trim();

  // Remove non-letter/number/space/punctuation chars except valid card name chars
  // Valid: letters, numbers, spaces, hyphens, apostrophes, commas, slashes, periods
  text = text.replace(/[^a-zA-Z0-9\s\-',./]/g, "");

  // Collapse multiple spaces
  text = text.replace(/\s+/g, " ").trim();

  // If the text contains " // " it's likely a split card — keep it
  // If it contains "/" but not "//", normalize
  text = text.replace(/\s*\/\s*/g, " // ").replace(/\/\/ \/\//g, "//");

  // Remove very short results (likely noise)
  if (text.length < 2) return "";

  return text;
}

/**
 * Preprocess a canvas image for better OCR results.
 * Increases contrast and converts to grayscale.
 */
export function preprocessImageData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    // Apply threshold for high contrast (binarization)
    const val = gray > 140 ? 255 : 0;

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
}
