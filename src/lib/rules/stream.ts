// Pure, isomorphic helpers for streaming Ask Harry rulings (NDJSON transport).

/**
 * Split a confidence-prefixed model output. The model is instructed to emit a
 * first line `Confidence: high|medium|low`. Returns:
 *  - settled: false while no newline has arrived yet (keep buffering)
 *  - confidence: the parsed value, or null if the first line wasn't a marker
 *  - rest: the remaining text once the first line is consumed (the whole buffer
 *    if the first line wasn't a confidence marker, so nothing is lost)
 */
export function parseConfidencePrefix(buf: string): {
  settled: boolean;
  confidence: "high" | "medium" | "low" | null;
  rest: string;
} {
  const nl = buf.indexOf("\n");
  if (nl === -1) return { settled: false, confidence: null, rest: "" };
  const first = buf.slice(0, nl).trim();
  const m = first.match(/^confidence\s*[:\-]\s*(high|medium|low)/i);
  const confidence = m ? (m[1].toLowerCase() as "high" | "medium" | "low") : null;
  const rest = confidence ? buf.slice(nl + 1).replace(/^\n+/, "") : buf;
  return { settled: true, confidence, rest };
}

export interface StreamEvent {
  type: string;
  [k: string]: unknown;
}

/** Parse complete NDJSON lines from a buffer, returning events + the leftover partial line. */
export function splitNdjson(buf: string): { events: StreamEvent[]; remainder: string } {
  const parts = buf.split("\n");
  const remainder = parts.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const line of parts) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t) as StreamEvent);
    } catch {
      /* skip malformed line */
    }
  }
  return { events, remainder };
}
