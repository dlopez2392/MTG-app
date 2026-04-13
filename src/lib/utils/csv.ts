import type { CollectionCard } from "@/types/collection";
import type { Binder } from "@/types/collection";

// ── Serialise ─────────────────────────────────────────────────────────────────
export const CSV_COLUMNS = [
  "scryfallId", "name", "quantity", "condition", "foil",
  "setCode", "setName", "collectorNumber", "priceUsd",
  "typeLine", "rarity", "binder",
] as const;

function escape(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function collectionToCsv(
  cards: CollectionCard[],
  binders: Binder[]
): string {
  const binderMap = new Map(binders.map((b) => [b.id ?? "", b.name]));
  const rows: string[] = [CSV_COLUMNS.join(",")];

  for (const c of cards) {
    rows.push([
      escape(c.scryfallId),
      escape(c.name),
      escape(c.quantity),
      escape(c.condition),
      escape(c.isFoil ? "true" : "false"),
      escape(c.setCode ?? ""),
      escape(c.setName ?? ""),
      escape(c.collectorNumber ?? ""),
      escape(c.priceUsd ?? ""),
      escape(c.typeLine ?? ""),
      escape(c.rarity ?? ""),
      escape(binderMap.get(c.binderId) ?? ""),
    ].join(","));
  }

  return rows.join("\n");
}

// ── Parse ─────────────────────────────────────────────────────────────────────
export interface CsvRow {
  scryfallId: string;
  name: string;
  quantity: number;
  condition: string;
  foil: boolean;
  setCode: string;
  setName: string;
  collectorNumber: string;
  priceUsd: string;
  typeLine: string;
  rarity: string;
  binder: string;    // binder name
  _error?: string;   // parse-time error message
}

/** Very small RFC-4180 tokeniser (handles quoted fields with embedded commas/newlines) */
function parseRecord(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // quoted field
      i++;
      let val = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      fields.push(val);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ["File appears to be empty or has no data rows."] };

  const headerLine = lines[0];
  const headers = parseRecord(headerLine).map((h) => h.trim().toLowerCase());

  const idx = (col: string) => headers.indexOf(col.toLowerCase());

  const nameIdx      = idx("name");
  const qtyIdx       = idx("quantity");
  const condIdx      = idx("condition");
  const foilIdx      = idx("foil");
  const setIdx       = idx("setcode");
  const setNameIdx   = idx("setname");
  const numIdx       = idx("collectornumber");
  const priceIdx     = idx("priceusd");
  const typeIdx      = idx("typeline");
  const rarityIdx    = idx("rarity");
  const binderIdx    = idx("binder");
  const sfIdIdx      = idx("scryfallid");

  if (nameIdx === -1) {
    return { rows: [], errors: ['Missing required column "name". Check your CSV headers.'] };
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseRecord(lines[i]);
    const get = (j: number) => (j >= 0 ? (fields[j] ?? "").trim() : "");

    const name = get(nameIdx);
    if (!name) { errors.push(`Row ${i + 1}: empty name — skipped`); continue; }

    const qty = parseInt(get(qtyIdx) || "1", 10);
    if (isNaN(qty) || qty < 1) { errors.push(`Row ${i + 1}: invalid quantity "${get(qtyIdx)}" — skipped`); continue; }

    rows.push({
      scryfallId:      get(sfIdIdx),
      name,
      quantity:        qty,
      condition:       get(condIdx) || "near_mint",
      foil:            get(foilIdx).toLowerCase() === "true",
      setCode:         get(setIdx),
      setName:         get(setNameIdx),
      collectorNumber: get(numIdx),
      priceUsd:        get(priceIdx),
      typeLine:        get(typeIdx),
      rarity:          get(rarityIdx),
      binder:          get(binderIdx) || "Default",
    });
  }

  return { rows, errors };
}
