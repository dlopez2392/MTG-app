export interface DeckCardInput {
  name: string;
  quantity: number;
  category: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  rarity?: string;
  priceUsd?: string | null;
}

/**
 * Build a compact, LLM-friendly digest of a decklist: counts, type breakdown,
 * average CMC, commander(s), the full mainboard, and sideboard. Shared by the
 * AI deck coach and the AI deck primer.
 */
export function buildDeckSummary(input: { deckName: string; format: string; cards: DeckCardInput[] }): string {
  const { deckName, format, cards } = input;
  const mainCards = cards.filter((c) => c.category === "main" || c.category === "commander");
  const sideboardCards = cards.filter((c) => c.category === "sideboard");
  const commanderCards = cards.filter((c) => c.category === "commander");

  const totalCards = mainCards.reduce((s, c) => s + c.quantity, 0);
  const lands = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Land"));
  const landCount = lands.reduce((s, c) => s + c.quantity, 0);
  const nonLands = mainCards.filter((c) => !c.typeLine?.split("—")[0].includes("Land"));
  const avgCmc = nonLands.length > 0
    ? nonLands.reduce((s, c) => s + (c.cmc ?? 0) * c.quantity, 0) / nonLands.reduce((s, c) => s + c.quantity, 0)
    : 0;

  const creatures = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Creature"));
  const instants = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Instant"));
  const sorceries = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Sorcery"));
  const enchantments = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Enchantment"));
  const artifacts = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Artifact"));
  const planeswalkers = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Planeswalker"));

  let summary = `Deck: "${deckName}"\nFormat: ${format}\nTotal cards: ${totalCards}\nLands: ${landCount}\nAverage CMC (non-lands): ${avgCmc.toFixed(2)}\n`;

  if (commanderCards.length > 0) {
    summary += `\nCommander(s):\n`;
    for (const c of commanderCards) {
      summary += `  ${c.quantity}x ${c.name} (${c.manaCost ?? "?"}, CMC ${c.cmc ?? "?"}) — ${c.typeLine ?? "?"}\n`;
    }
  }

  summary += `\nType breakdown:\n`;
  summary += `  Creatures: ${creatures.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Instants: ${instants.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Sorceries: ${sorceries.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Enchantments: ${enchantments.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Artifacts: ${artifacts.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Planeswalkers: ${planeswalkers.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Lands: ${landCount}\n`;

  summary += `\nFull decklist:\n`;
  for (const c of mainCards) {
    summary += `${c.quantity}x ${c.name} (${c.manaCost ?? "N/A"}, CMC ${c.cmc ?? 0}, ${c.typeLine ?? "Unknown"}${c.priceUsd ? `, $${c.priceUsd}` : ""})\n`;
  }

  if (sideboardCards.length > 0) {
    summary += `\nSideboard:\n`;
    for (const c of sideboardCards) {
      summary += `${c.quantity}x ${c.name} (${c.manaCost ?? "N/A"}, CMC ${c.cmc ?? 0}, ${c.typeLine ?? "Unknown"})\n`;
    }
  }

  return summary;
}
