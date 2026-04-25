import type { DeckCard } from "@/types/deck";

// ── Combinatorics ──

function logFactorial(n: number): number {
  let sum = 0;
  for (let i = 2; i <= n; i++) sum += Math.log(i);
  return sum;
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function choose(n: number, k: number): number {
  return Math.exp(logChoose(n, k));
}

export function hypergeometric(N: number, K: number, n: number, k: number): number {
  if (k > K || k > n || n - k > N - K) return 0;
  return Math.exp(logChoose(K, k) + logChoose(N - K, n - k) - logChoose(N, n));
}

export function hypergeometricAtLeast(N: number, K: number, n: number, minK: number): number {
  let prob = 0;
  for (let k = minK; k <= Math.min(K, n); k++) {
    prob += hypergeometric(N, K, n, k);
  }
  return prob;
}

// ── Mulligan probability ──

export interface MulliganQuery {
  label: string;
  filter: (card: DeckCard) => boolean;
  minCount: number;
}

export interface MulliganResult {
  label: string;
  deckCount: number;
  probability7: number;
  probabilityMull1: number;
}

export function calculateMulliganProbabilities(
  cards: DeckCard[],
  queries: MulliganQuery[]
): MulliganResult[] {
  const mainCards = cards.filter((c) => c.category === "main" || c.category === "commander");
  const deckSize = mainCards.reduce((s, c) => s + c.quantity, 0);

  return queries.map((q) => {
    const matchCount = mainCards.filter(q.filter).reduce((s, c) => s + c.quantity, 0);
    return {
      label: q.label,
      deckCount: matchCount,
      probability7: hypergeometricAtLeast(deckSize, matchCount, 7, q.minCount),
      probabilityMull1: 1 - (1 - hypergeometricAtLeast(deckSize, matchCount, 7, q.minCount)) ** 2,
    };
  });
}

// ── Monte Carlo hand simulation ──

export interface MonteCarloResult {
  avgLands: number;
  avgCmc: number;
  avgSpells: number;
  landDistribution: number[];
  keepableRate: number;
  sampleHands: { cards: string[]; lands: number; avgCmc: number }[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function monteCarloHands(
  cards: DeckCard[],
  iterations: number = 10000,
  handSize: number = 7
): MonteCarloResult {
  const pool: DeckCard[] = [];
  for (const c of cards) {
    if (c.category !== "main" && c.category !== "commander") continue;
    for (let i = 0; i < c.quantity; i++) pool.push(c);
  }

  if (pool.length < handSize) {
    return { avgLands: 0, avgCmc: 0, avgSpells: 0, landDistribution: Array(handSize + 1).fill(0), keepableRate: 0, sampleHands: [] };
  }

  let totalLands = 0;
  let totalCmc = 0;
  let totalSpells = 0;
  let keepable = 0;
  const landDist = Array(handSize + 1).fill(0);
  const samples: MonteCarloResult["sampleHands"] = [];

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffleArray(pool);
    const hand = shuffled.slice(0, handSize);

    const lands = hand.filter((c) => c.typeLine?.split("—")[0].includes("Land")).length;
    const spells = hand.filter((c) => !c.typeLine?.split("—")[0].includes("Land"));
    const avgCmc = spells.length > 0 ? spells.reduce((s, c) => s + (c.cmc ?? 0), 0) / spells.length : 0;

    totalLands += lands;
    totalCmc += avgCmc;
    totalSpells += spells.length;
    landDist[lands]++;

    // "Keepable" = 2-5 lands in opening 7
    if (lands >= 2 && lands <= 5) keepable++;

    if (samples.length < 5) {
      samples.push({
        cards: hand.map((c) => c.name),
        lands,
        avgCmc: Math.round(avgCmc * 10) / 10,
      });
    }
  }

  return {
    avgLands: totalLands / iterations,
    avgCmc: totalCmc / iterations,
    avgSpells: totalSpells / iterations,
    landDistribution: landDist.map((c) => (c / iterations) * 100),
    keepableRate: (keepable / iterations) * 100,
    sampleHands: samples,
  };
}

// ── Goal turn calculator ──

export interface GoalTurnQuery {
  cardName: string;
  cmc: number;
  turnTarget: number;
  copiesInDeck: number;
}

export interface GoalTurnResult {
  cardName: string;
  turnTarget: number;
  copiesInDeck: number;
  cmc: number;
  probDrawCard: number;
  probHaveMana: number;
  probBoth: number;
  suggestion: string;
}

export function calculateGoalTurn(
  cards: DeckCard[],
  query: GoalTurnQuery
): GoalTurnResult {
  const mainCards = cards.filter((c) => c.category === "main" || c.category === "commander");
  const deckSize = mainCards.reduce((s, c) => s + c.quantity, 0);
  const landCount = mainCards
    .filter((c) => c.typeLine?.split("—")[0].includes("Land"))
    .reduce((s, c) => s + c.quantity, 0);

  // Cards seen by turn T = 7 (opening) + (T-1) draws
  const cardsSeen = Math.min(7 + (query.turnTarget - 1), deckSize);

  // Probability of drawing at least 1 copy of the target card by turn T
  const probDrawCard = hypergeometricAtLeast(deckSize, query.copiesInDeck, cardsSeen, 1);

  // Probability of having enough lands by turn T
  // Need CMC lands by turn T. Cards seen = cardsSeen.
  const landsNeeded = query.cmc;
  const probHaveMana = hypergeometricAtLeast(deckSize, landCount, cardsSeen, landsNeeded);

  // Combined probability (simplified — assumes independence)
  const probBoth = probDrawCard * probHaveMana;

  // Suggestion
  let suggestion = "";
  if (probBoth >= 0.8) {
    suggestion = "Very likely — your deck is well-built for this goal.";
  } else if (probBoth >= 0.6) {
    suggestion = "Reasonable odds. Consider adding draw or tutors to improve consistency.";
  } else if (probBoth >= 0.4) {
    suggestion = "Coin flip. Add more copies, ramp, or card draw to hit this reliably.";
  } else if (probBoth >= 0.2) {
    suggestion = "Unlikely. You'll need significantly more ramp or tutors.";
  } else {
    const extraLandsNeeded = Math.max(0, Math.ceil(landsNeeded * deckSize / cardsSeen) - landCount);
    suggestion = `Very unlikely. Consider adding ${extraLandsNeeded > 0 ? `~${extraLandsNeeded} more lands and ` : ""}more copies or tutors.`;
  }

  return {
    cardName: query.cardName,
    turnTarget: query.turnTarget,
    copiesInDeck: query.copiesInDeck,
    cmc: query.cmc,
    probDrawCard,
    probHaveMana,
    probBoth,
    suggestion,
  };
}
