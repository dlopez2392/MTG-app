"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import type { DeckCard } from "@/types/deck";
import {
  calculateMulliganProbabilities,
  monteCarloHands,
  calculateGoalTurn,
  type MulliganResult,
  type MonteCarloResult,
  type GoalTurnResult,
} from "@/lib/utils/deckMath";

interface Props {
  cards: DeckCard[];
}

function ProbBar({ value, color = "accent" }: { value: number; color?: string }) {
  const pct = Math.min(value * 100, 100);
  const bg = color === "green" ? "#22C55E" : color === "amber" ? "#F59E0B" : color === "red" ? "#EF4444" : "#7C5CFC";
  const glow = color === "green" ? "rgba(34,197,94,0.3)" : color === "amber" ? "rgba(245,158,11,0.3)" : color === "red" ? "rgba(239,68,68,0.3)" : "rgba(124,92,252,0.3)";

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: bg, boxShadow: `0 0 8px ${glow}` }}
        />
      </div>
      <span className="text-xs font-bold text-white/70 w-12 text-right tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

function probColor(p: number): string {
  if (p >= 0.8) return "green";
  if (p >= 0.5) return "amber";
  return "red";
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-2xl p-[1px] overflow-hidden", className)}
      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)" }}
    >
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(15,15,25,0.95) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))" }}
      >
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</h2>
    </div>
  );
}

// ── Mulligan Calculator ──

function MulliganCalculator({ cards }: Props) {
  const results = useMemo<MulliganResult[]>(() => {
    const queries = [
      {
        label: "At least 2 lands",
        filter: (c: DeckCard) => !!c.typeLine?.split("—")[0].includes("Land"),
        minCount: 2,
      },
      {
        label: "At least 3 lands",
        filter: (c: DeckCard) => !!c.typeLine?.split("—")[0].includes("Land"),
        minCount: 3,
      },
      {
        label: "At least 1 ramp spell (CMC ≤ 2)",
        filter: (c: DeckCard) => !c.typeLine?.split("—")[0].includes("Land") && (c.cmc ?? 99) <= 2,
        minCount: 1,
      },
      {
        label: "At least 1 creature",
        filter: (c: DeckCard) => !!c.typeLine?.split("—")[0].includes("Creature"),
        minCount: 1,
      },
      {
        label: "At least 1 instant/sorcery",
        filter: (c: DeckCard) => {
          const t = c.typeLine?.split("—")[0] ?? "";
          return t.includes("Instant") || t.includes("Sorcery");
        },
        minCount: 1,
      },
    ];
    return calculateMulliganProbabilities(cards, queries);
  }, [cards]);

  return (
    <GlassCard>
      <SectionHeader
        icon="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z"
        title="Mulligan Probabilities"
      />
      <div className="flex flex-col gap-3">
        {results.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/60">{r.label}</span>
              <span className="text-[10px] text-white/30">{r.deckCount} in deck</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[10px] text-white/40 w-16">Opening 7:</span>
                  <ProbBar value={r.probability7} color={probColor(r.probability7)} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/40 w-16">w/ 1 mull:</span>
                  <ProbBar value={r.probabilityMull1} color={probColor(r.probabilityMull1)} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ── Monte Carlo Simulator ──

function MonteCarloSimulator({ cards }: Props) {
  const [results, setResults] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState(10000);

  function runSimulation() {
    setRunning(true);
    setTimeout(() => {
      const res = monteCarloHands(cards, iterations);
      setResults(res);
      setRunning(false);
    }, 50);
  }

  return (
    <GlassCard>
      <SectionHeader
        icon="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
        title="Monte Carlo Simulator"
      />

      <div className="flex items-center gap-3 mb-4">
        <select
          value={iterations}
          onChange={(e) => setIterations(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none focus:border-accent/50 [&>option]:text-black [&>option]:bg-white"
        >
          <option value={1000}>1,000 hands</option>
          <option value={10000}>10,000 hands</option>
          <option value={50000}>50,000 hands</option>
          <option value={100000}>100,000 hands</option>
        </select>
        <button
          onClick={runSimulation}
          disabled={running}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #7C5CFC, #6347E0)",
            color: "white",
            boxShadow: "0 2px 12px rgba(124,92,252,0.3)",
          }}
        >
          {running ? "Simulating..." : "Run Simulation"}
        </button>
      </div>

      {results && (
        <div className="flex flex-col gap-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Avg Lands", value: results.avgLands.toFixed(1) },
              { label: "Avg Spells", value: results.avgSpells.toFixed(1) },
              { label: "Keepable", value: `${results.keepableRate.toFixed(1)}%` },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: "rgba(124,92,252,0.08)", boxShadow: "inset 0 0 12px rgba(124,92,252,0.05)" }}
              >
                <p className="text-lg font-bold text-white/90">{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Land distribution histogram */}
          <div>
            <p className="text-xs text-white/50 mb-2">Land count distribution in opening 7</p>
            <div className="flex items-end gap-1 h-24">
              {results.landDistribution.slice(0, 8).map((pct, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-white/40 tabular-nums">
                    {pct > 0.5 ? `${pct.toFixed(0)}%` : ""}
                  </span>
                  <div className="w-full relative" style={{ height: "60px" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t"
                      style={{
                        height: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                        background: i >= 2 && i <= 4
                          ? "linear-gradient(180deg, #22C55E, #16A34A)"
                          : i === 1 || i === 5
                            ? "linear-gradient(180deg, #F59E0B, #D97706)"
                            : "linear-gradient(180deg, #EF4444, #DC2626)",
                        boxShadow: pct > 0 ? `0 0 6px ${i >= 2 && i <= 4 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}` : "none",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-white/50 font-semibold">{i}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-1 text-center">Green = ideal (2–4 lands), amber = borderline, red = mulligan territory</p>
          </div>

          {/* Sample hands */}
          <div>
            <p className="text-xs text-white/50 mb-2">Sample opening hands</p>
            <div className="flex flex-col gap-2">
              {results.sampleHands.map((hand, i) => (
                <div
                  key={i}
                  className="rounded-xl px-3 py-2 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/60 truncate">{hand.cards.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-green-400/70">{hand.lands}L</span>
                    <span className="text-[10px] text-blue-400/70">{hand.avgCmc} avg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!results && (
        <p className="text-xs text-white/30 text-center py-4">
          Run a simulation to see opening hand statistics across thousands of games
        </p>
      )}
    </GlassCard>
  );
}

// ── Goal Turn Calculator ──

function GoalTurnCalculator({ cards }: Props) {
  const mainCards = useMemo(
    () => cards.filter((c) => c.category === "main" || c.category === "commander"),
    [cards]
  );

  const uniqueCards = useMemo(() => {
    const seen = new Map<string, DeckCard>();
    for (const c of mainCards) {
      if (!c.typeLine?.split("—")[0].includes("Land") && !seen.has(c.name)) {
        seen.set(c.name, c);
      }
    }
    return Array.from(seen.values()).sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0));
  }, [mainCards]);

  const [selectedCard, setSelectedCard] = useState("");
  const [goalTurn, setGoalTurn] = useState(4);
  const [result, setResult] = useState<GoalTurnResult | null>(null);

  function calculate() {
    const card = uniqueCards.find((c) => c.name === selectedCard);
    if (!card) return;

    const copies = mainCards.filter((c) => c.name === card.name).reduce((s, c) => s + c.quantity, 0);
    const res = calculateGoalTurn(cards, {
      cardName: card.name,
      cmc: card.cmc ?? 0,
      turnTarget: goalTurn,
      copiesInDeck: copies,
    });
    setResult(res);
  }

  return (
    <GlassCard>
      <SectionHeader
        icon="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
        title="Goal Turn Calculator"
      />

      <p className="text-xs text-white/40 mb-4">
        Select a card and target turn — see the probability of casting it on time given your current deck.
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Target Card</label>
          <select
            value={selectedCard}
            onChange={(e) => { setSelectedCard(e.target.value); setResult(null); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-accent/50 [&>option]:text-black [&>option]:bg-white"
          >
            <option value="">Choose a card...</option>
            {uniqueCards.map((c) => (
              <option key={c.scryfallId} value={c.name}>
                {c.name} ({c.cmc ?? 0} CMC)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">
            Cast by turn {goalTurn}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              value={goalTurn}
              onChange={(e) => { setGoalTurn(Number(e.target.value)); setResult(null); }}
              className="flex-1 accent-accent"
            />
            <span className="text-sm font-bold text-white/70 w-6 text-center tabular-nums">{goalTurn}</span>
          </div>
        </div>

        <button
          onClick={calculate}
          disabled={!selectedCard}
          className="px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-30"
          style={{
            background: "linear-gradient(135deg, #7C5CFC, #6347E0)",
            color: "white",
            boxShadow: "0 2px 12px rgba(124,92,252,0.3)",
          }}
        >
          Calculate Probability
        </button>
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-xl p-4"
            style={{
              background: `rgba(${result.probBoth >= 0.6 ? "34,197,94" : result.probBoth >= 0.3 ? "245,158,11" : "239,68,68"},0.08)`,
              boxShadow: `inset 0 0 20px rgba(${result.probBoth >= 0.6 ? "34,197,94" : result.probBoth >= 0.3 ? "245,158,11" : "239,68,68"},0.05)`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Cast {result.cardName} by turn {result.turnTarget}</span>
              <span className="text-2xl font-bold" style={{ color: result.probBoth >= 0.6 ? "#22C55E" : result.probBoth >= 0.3 ? "#F59E0B" : "#EF4444" }}>
                {(result.probBoth * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-white/40">{result.suggestion}</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-28">Draw the card:</span>
              <ProbBar value={result.probDrawCard} color={probColor(result.probDrawCard)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-28">Have {result.cmc} mana:</span>
              <ProbBar value={result.probHaveMana} color={probColor(result.probHaveMana)} />
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-white/30">
            <span>{result.copiesInDeck} cop{result.copiesInDeck === 1 ? "y" : "ies"} in deck</span>
            <span>·</span>
            <span>{result.cmc} CMC</span>
            <span>·</span>
            <span>{7 + result.turnTarget - 1} cards seen by turn {result.turnTarget}</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ── Main export ──

export default function DeckIntelligence({ cards }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <MulliganCalculator cards={cards} />
      <MonteCarloSimulator cards={cards} />
      <GoalTurnCalculator cards={cards} />
    </div>
  );
}
