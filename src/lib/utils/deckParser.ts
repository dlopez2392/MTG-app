export interface ParsedDeckEntry {
  quantity: number;
  name: string;
  category: "main" | "sideboard" | "commander" | "maybeboard";
}

export function parseDeckList(text: string): ParsedDeckEntry[] {
  const lines = text.trim().split("\n");
  const entries: ParsedDeckEntry[] = [];
  let currentCategory: ParsedDeckEntry["category"] = "main";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Section headers
    if (/^(sideboard|sb):?$/i.test(line)) {
      currentCategory = "sideboard";
      continue;
    }
    if (/^commander:?$/i.test(line)) {
      currentCategory = "commander";
      continue;
    }
    if (/^(maybeboard|maybe):?$/i.test(line)) {
      currentCategory = "maybeboard";
      continue;
    }
    if (/^(mainboard|main|deck):?$/i.test(line)) {
      currentCategory = "main";
      continue;
    }
    // Skip comment lines
    if (line.startsWith("//") || line.startsWith("#")) continue;

    // Parse "4 Lightning Bolt" or "4x Lightning Bolt"
    const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (match) {
      entries.push({
        quantity: parseInt(match[1], 10),
        name: match[2].trim(),
        category: currentCategory,
      });
    } else {
      // Just a card name, assume qty 1
      entries.push({
        quantity: 1,
        name: line,
        category: currentCategory,
      });
    }
  }

  return entries;
}

export function exportDeckList(
  cards: { name: string; quantity: number; category: string }[]
): string {
  const lines: string[] = [];
  const groups: Record<string, typeof cards> = {};

  for (const card of cards) {
    const cat = card.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(card);
  }

  if (groups["commander"]) {
    lines.push("Commander");
    for (const c of groups["commander"]) lines.push(`${c.quantity} ${c.name}`);
    lines.push("");
  }

  if (groups["main"]) {
    for (const c of groups["main"]) lines.push(`${c.quantity} ${c.name}`);
    lines.push("");
  }

  if (groups["sideboard"]) {
    lines.push("Sideboard");
    for (const c of groups["sideboard"]) lines.push(`${c.quantity} ${c.name}`);
    lines.push("");
  }

  if (groups["maybeboard"]) {
    lines.push("Maybeboard");
    for (const c of groups["maybeboard"]) lines.push(`${c.quantity} ${c.name}`);
  }

  return lines.join("\n").trim();
}
