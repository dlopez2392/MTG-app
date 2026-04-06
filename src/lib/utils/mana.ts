import type { SearchFilters } from "@/types/card";

export function parseManaCost(manaCost: string): string[] {
  const symbols: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(manaCost)) !== null) {
    symbols.push(match[1]);
  }
  return symbols;
}

export function getManaSymbolColor(symbol: string): string {
  const colors: Record<string, string> = {
    W: "var(--color-mtg-white)",
    U: "var(--color-mtg-blue)",
    B: "var(--color-mtg-black)",
    R: "var(--color-mtg-red)",
    G: "var(--color-mtg-green)",
    C: "var(--color-mtg-colorless)",
  };
  if (symbol in colors) return colors[symbol];
  if (/^\d+$/.test(symbol)) return "var(--color-mtg-colorless)";
  if (symbol === "X") return "var(--color-mtg-colorless)";
  // Hybrid mana
  if (symbol.includes("/")) return "var(--color-mtg-gold)";
  return "var(--color-mtg-colorless)";
}

export function buildScryfallQuery(filters: SearchFilters): string {
  const parts: string[] = [];

  if (filters.query) {
    parts.push(filters.query);
  }

  if (filters.colors.length > 0) {
    const colorStr = filters.colors.join("");
    switch (filters.colorMode) {
      case "exact":
        parts.push(`c=${colorStr}`);
        break;
      case "at_most":
        parts.push(`c<=${colorStr}`);
        break;
      default:
        parts.push(`c:${colorStr}`);
    }
  }

  if (filters.type) {
    parts.push(`t:${filters.type}`);
  }

  if (filters.rarity) {
    parts.push(`r:${filters.rarity}`);
  }

  if (filters.format) {
    parts.push(`f:${filters.format}`);
  }

  if (filters.set) {
    parts.push(`s:${filters.set}`);
  }

  if (filters.cmc) {
    parts.push(`cmc${filters.cmcComparison}${filters.cmc}`);
  }

  return parts.join(" ");
}
