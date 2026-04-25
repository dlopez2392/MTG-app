import type { DeckCard } from "@/types/deck";
import {
  GAME_CHANGERS,
  FAST_MANA,
  TUTORS,
  MLD_CARDS,
  EXTRA_TURNS,
  STAX_PIECES,
  COMBO_PIECES,
} from "@/lib/data/bracketData";

export interface BracketSignals {
  gameChangers: string[];
  fastMana: string[];
  tutors: string[];
  mldCards: string[];
  extraTurns: string[];
  staxPieces: string[];
  comboPieces: string[];
  avgCmc: number;
  landCount: number;
  totalCards: number;
  interactionCount: number;
}

export interface LocalBracketResult {
  bracket: number;
  confidence: number;
  signals: BracketSignals;
  reasons: string[];
}

function isLand(card: DeckCard): boolean {
  return !!card.typeLine?.split("—")[0].includes("Land");
}

function isInteraction(card: DeckCard): boolean {
  const tl = card.typeLine?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  const isInstantSorcery = tl.includes("instant") || tl.includes("sorcery");
  const keywords = ["destroy", "exile", "counter", "remove", "bounce", "wrath", "board wipe"];
  return isInstantSorcery || keywords.some((k) => name.includes(k));
}

export function analyzeLocalBracket(cards: DeckCard[]): LocalBracketResult {
  const mainCards = cards.filter((c) => c.category === "main" || c.category === "commander");
  const totalCards = mainCards.reduce((s, c) => s + c.quantity, 0);

  const signals: BracketSignals = {
    gameChangers: [],
    fastMana: [],
    tutors: [],
    mldCards: [],
    extraTurns: [],
    staxPieces: [],
    comboPieces: [],
    avgCmc: 0,
    landCount: 0,
    totalCards,
    interactionCount: 0,
  };

  const reasons: string[] = [];

  for (const card of mainCards) {
    const name = card.name;

    if (GAME_CHANGERS.has(name)) signals.gameChangers.push(name);
    if (FAST_MANA.has(name)) signals.fastMana.push(name);
    if (TUTORS.has(name)) signals.tutors.push(name);
    if (MLD_CARDS.has(name)) signals.mldCards.push(name);
    if (EXTRA_TURNS.has(name)) signals.extraTurns.push(name);
    if (STAX_PIECES.has(name)) signals.staxPieces.push(name);
    if (COMBO_PIECES.has(name)) signals.comboPieces.push(name);
    if (isLand(card)) signals.landCount += card.quantity;
    if (isInteraction(card)) signals.interactionCount += card.quantity;
  }

  const nonLands = mainCards.filter((c) => !isLand(c));
  signals.avgCmc = nonLands.length > 0
    ? nonLands.reduce((s, c) => s + (c.cmc ?? 0) * c.quantity, 0) / nonLands.reduce((s, c) => s + c.quantity, 0)
    : 0;

  // ── Bracket scoring ──
  let bracket = 1;
  let score = 0;

  // Game Changers = automatic Bracket 4
  if (signals.gameChangers.length > 0) {
    score += signals.gameChangers.length * 15;
    reasons.push(`${signals.gameChangers.length} Game Changer card(s): ${signals.gameChangers.slice(0, 5).join(", ")}${signals.gameChangers.length > 5 ? "..." : ""}`);
  }

  // Fast mana density
  if (signals.fastMana.length >= 4) {
    score += 20;
    reasons.push(`High fast mana density (${signals.fastMana.length} sources)`);
  } else if (signals.fastMana.length >= 2) {
    score += 10;
    reasons.push(`Moderate fast mana (${signals.fastMana.length} sources)`);
  }

  // Tutor density
  if (signals.tutors.length >= 5) {
    score += 20;
    reasons.push(`Very high tutor density (${signals.tutors.length} tutors)`);
  } else if (signals.tutors.length >= 3) {
    score += 12;
    reasons.push(`High tutor density (${signals.tutors.length} tutors)`);
  } else if (signals.tutors.length >= 1) {
    score += 5;
    reasons.push(`${signals.tutors.length} tutor(s) present`);
  }

  // Combo pieces
  if (signals.comboPieces.length >= 4) {
    score += 18;
    reasons.push(`Multiple combo pieces detected (${signals.comboPieces.length} cards)`);
  } else if (signals.comboPieces.length >= 2) {
    score += 10;
    reasons.push(`Some combo potential (${signals.comboPieces.length} pieces)`);
  }

  // Stax / denial
  if (signals.staxPieces.length >= 5) {
    score += 18;
    reasons.push(`Heavy stax package (${signals.staxPieces.length} pieces)`);
  } else if (signals.staxPieces.length >= 3) {
    score += 10;
    reasons.push(`Moderate stax presence (${signals.staxPieces.length} pieces)`);
  } else if (signals.staxPieces.length >= 1) {
    score += 4;
  }

  // MLD
  if (signals.mldCards.length >= 2) {
    score += 15;
    reasons.push(`Mass land destruction package (${signals.mldCards.length} cards)`);
  } else if (signals.mldCards.length === 1) {
    score += 8;
    reasons.push(`MLD present: ${signals.mldCards[0]}`);
  }

  // Extra turns
  if (signals.extraTurns.length >= 3) {
    score += 15;
    reasons.push(`Multiple extra turn spells (${signals.extraTurns.length})`);
  } else if (signals.extraTurns.length >= 1) {
    score += 6;
    reasons.push(`Extra turn spell(s): ${signals.extraTurns.join(", ")}`);
  }

  // Low avg CMC = faster deck
  if (signals.avgCmc < 2.0) {
    score += 8;
    reasons.push(`Very low average CMC (${signals.avgCmc.toFixed(2)}) indicates fast gameplan`);
  } else if (signals.avgCmc < 2.5) {
    score += 4;
  }

  // Determine bracket from score
  if (score >= 30) bracket = 4;
  else if (score >= 18) bracket = 3;
  else if (score >= 8) bracket = 2;
  else bracket = 1;

  // Confidence based on signal clarity
  let confidence = 0.6;
  if (score >= 40 || score <= 3) confidence = 0.9;
  else if (score >= 25 || score <= 6) confidence = 0.8;
  else confidence = 0.65;

  if (reasons.length === 0) {
    reasons.push("No major power-level signals detected — appears to be a casual build");
  }

  return { bracket, confidence, signals, reasons };
}
