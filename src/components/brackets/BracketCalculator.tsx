"use client";

import { useState, useEffect, useCallback } from "react";
import { useDecks, useDeckCards } from "@/hooks/useDecks";
import { analyzeLocalBracket } from "@/lib/utils/bracketAnalysis";
import { cn } from "@/lib/utils/cn";
import type { Deck, DeckCard } from "@/types/deck";

interface ComboLine {
  cards: string[];
  description: string;
  speed: string;
}

interface UpgradeSwap {
  cut: string;
  add: string;
  reason: string;
  bracketImpact: string;
}

interface UpgradePath {
  tier: string;
  currentBracket: number;
  targetBracket: number;
  swaps: UpgradeSwap[];
  warning: string;
}

interface BracketResult {
  bracket: number;
  bracketLabel: string;
  confidence: number;
  summary: string;
  expectedClosingTurn: string;
  winConditions: string[];
  comboLines: ComboLine[];
  spicyInclusions: string[];
  mldPresent: boolean;
  extraTurnsPresent: boolean;
  infiniteCombos: boolean;
  staxLevel: string;
  rule0Summary: string;
  upgradePaths: UpgradePath[];
}

const BRACKET_STYLES: Record<number, { color: string; bg: string; glow: string; gradient: string; label: string }> = {
  1: {
    color: "#22C55E",
    bg: "rgba(34,197,94,0.12)",
    glow: "rgba(34,197,94,0.25)",
    gradient: "linear-gradient(135deg, rgba(34,197,94,0.4), rgba(34,197,94,0.1))",
    label: "Casual",
  },
  2: {
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
    glow: "rgba(59,130,246,0.25)",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(59,130,246,0.1))",
    label: "Focused",
  },
  3: {
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    glow: "rgba(245,158,11,0.25)",
    gradient: "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(245,158,11,0.1))",
    label: "Optimized",
  },
  4: {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    glow: "rgba(239,68,68,0.25)",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.4), rgba(239,68,68,0.1))",
    label: "Competitive",
  },
};

function BracketBadge({ bracket, size = "sm" }: { bracket: number; size?: "sm" | "lg" }) {
  const style = BRACKET_STYLES[bracket] ?? BRACKET_STYLES[1];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-black rounded-xl",
        size === "lg" ? "w-16 h-16 text-3xl" : "w-8 h-8 text-base"
      )}
      style={{
        background: style.bg,
        color: style.color,
        boxShadow: `0 0 20px ${style.glow}, inset 0 0 16px ${style.glow}`,
      }}
    >
      {bracket}
    </span>
  );
}

function SignalTag({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
      style={{ background: `${color}15` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs font-medium" style={{ color }}>{count}</span>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

function FlagBadge({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <span
      className={cn("text-[11px] px-2.5 py-1 rounded-lg font-medium", active ? "" : "opacity-30")}
      style={{
        background: active ? `${color}20` : "rgba(255,255,255,0.03)",
        color: active ? color : "rgba(255,255,255,0.3)",
      }}
    >
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function BracketCalculator() {
  const { allDecks: decks } = useDecks();
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [result, setResult] = useState<BracketResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRule0Card, setShowRule0Card] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  const { cards } = useDeckCards(selectedDeckId || undefined);

  useEffect(() => {
    if (decks && decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id ?? "");
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    if (decks && selectedDeckId) {
      setSelectedDeck(decks.find((d) => d.id === selectedDeckId) ?? null);
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [selectedDeckId]);

  const analyze = useCallback(async () => {
    if (!cards || cards.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const local = analyzeLocalBracket(cards);

      const res = await fetch("/api/bracket-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckName: selectedDeck?.name ?? "Untitled",
          cards: cards.map((c) => ({
            name: c.name,
            quantity: c.quantity,
            category: c.category,
            manaCost: c.manaCost,
            cmc: c.cmc,
            typeLine: c.typeLine,
          })),
          localBracket: local.bracket,
          localSignals: local.signals,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [cards, selectedDeck]);

  const localAnalysis = cards && cards.length > 0 ? analyzeLocalBracket(cards) : null;

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      {/* ── Deck Selector ── */}
      <div
        className="rounded-2xl p-[1px] overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))" }}
      >
        <div
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,25,0.95))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(124,92,252,0.4), rgba(234,179,8,0.2))",
                boxShadow: "0 0 20px rgba(124,92,252,0.2)",
              }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider">Bracket Calculator</h2>
              <p className="text-[10px] text-white/30">Hybrid local analysis + Gemini AI</p>
            </div>
          </div>

          <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-1.5 block">Select Deck</label>
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white/80 mb-4 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {!decks || decks.length === 0 ? (
              <option value="">No decks available</option>
            ) : (
              decks.map((d) => (
                <option key={d.id} value={d.id ?? ""}>{d.name}{d.format ? ` (${d.format})` : ""}</option>
              ))
            )}
          </select>

          {/* Quick local signals preview */}
          {localAnalysis && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <BracketBadge bracket={localAnalysis.bracket} />
                <div>
                  <p className="text-sm font-semibold text-white/70">
                    Quick Scan: Bracket {localAnalysis.bracket}
                    <span className="text-xs text-white/30 ml-2">({BRACKET_STYLES[localAnalysis.bracket]?.label})</span>
                  </p>
                  <p className="text-[10px] text-white/30">Based on hard signals — run AI analysis for full evaluation</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <SignalTag label="Game Changers" count={localAnalysis.signals.gameChangers.length} color="#EF4444" />
                <SignalTag label="Fast Mana" count={localAnalysis.signals.fastMana.length} color="#F59E0B" />
                <SignalTag label="Tutors" count={localAnalysis.signals.tutors.length} color="#A855F7" />
                <SignalTag label="Combo Pieces" count={localAnalysis.signals.comboPieces.length} color="#EC4899" />
                <SignalTag label="Stax" count={localAnalysis.signals.staxPieces.length} color="#6366F1" />
                <SignalTag label="MLD" count={localAnalysis.signals.mldCards.length} color="#EF4444" />
                <SignalTag label="Extra Turns" count={localAnalysis.signals.extraTurns.length} color="#06B6D4" />
              </div>
            </div>
          )}

          <button
            onClick={analyze}
            disabled={loading || !cards || cards.length === 0}
            className="w-full px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #7C5CFC, #6347E0)",
              color: "white",
              boxShadow: "0 4px 20px rgba(124,92,252,0.4)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing with AI...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Run Full Bracket Analysis
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={analyze} className="mt-2 text-xs text-red-400/70 hover:text-red-400 transition-colors">
            Try again
          </button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {/* ── Bracket Result ── */}
          <div
            className="rounded-2xl p-[1px] overflow-hidden"
            style={{ background: BRACKET_STYLES[result.bracket]?.gradient }}
          >
            <div
              className="rounded-2xl p-5"
              style={{
                background: "linear-gradient(135deg, rgba(20,20,30,0.9), rgba(15,15,25,0.95))",
                boxShadow: `inset 0 0 32px ${BRACKET_STYLES[result.bracket]?.glow ?? "transparent"}`,
              }}
            >
              <div className="flex items-center gap-4 mb-4">
                <BracketBadge bracket={result.bracket} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold" style={{ color: BRACKET_STYLES[result.bracket]?.color }}>
                    Bracket {result.bracket} — {result.bracketLabel}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{result.summary}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-white/30">Confidence:</span>
                    <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(result.confidence ?? 0.8) * 100}%`,
                          background: BRACKET_STYLES[result.bracket]?.color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40">{Math.round((result.confidence ?? 0.8) * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Flags row */}
              <div className="flex flex-wrap gap-1.5">
                <FlagBadge label="Infinite Combos" active={result.infiniteCombos} color="#EF4444" />
                <FlagBadge label="MLD" active={result.mldPresent} color="#F59E0B" />
                <FlagBadge label="Extra Turns" active={result.extraTurnsPresent} color="#06B6D4" />
                <FlagBadge label={`Stax: ${result.staxLevel}`} active={result.staxLevel !== "none"} color="#A855F7" />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-white/40">Expected closing turn: <strong className="text-white/60">{result.expectedClosingTurn}</strong></span>
              </div>
            </div>
          </div>

          {/* ── Rule 0 Card ── */}
          <div
            className="rounded-2xl p-[1px] overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))" }}
          >
            <div
              className="rounded-2xl p-5"
              style={{
                background: "linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,25,0.95))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <button
                onClick={() => setShowRule0Card(!showRule0Card)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Rule 0 Conversation Card</h3>
                </div>
                <svg
                  className={cn("w-4 h-4 text-white/30 transition-transform", showRule0Card && "rotate-180")}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showRule0Card && (
                <div className="mt-4">
                  <div
                    className="rounded-xl p-4 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${BRACKET_STYLES[result.bracket]?.bg}, rgba(255,255,255,0.02))`,
                      border: `1px solid ${BRACKET_STYLES[result.bracket]?.color}30`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <BracketBadge bracket={result.bracket} />
                      <span className="text-sm font-bold text-white/80">{selectedDeck?.name ?? "Untitled Deck"}</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{result.rule0Summary}</p>

                    {result.winConditions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Win Conditions</p>
                        <ul className="flex flex-col gap-1">
                          {result.winConditions.map((wc, i) => (
                            <li key={i} className="text-xs text-white/50 flex items-start gap-1.5">
                              <span className="text-accent mt-0.5">•</span>
                              <span>{wc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.spicyInclusions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Worth Flagging</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.spicyInclusions.map((card) => (
                            <span
                              key={card}
                              className="px-2 py-1 rounded-md text-[11px] text-amber-400/80 font-medium"
                              style={{ background: "rgba(245,158,11,0.1)" }}
                            >
                              {card}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Combo Lines ── */}
          {result.comboLines?.length > 0 && (
            <Section title="Combo Lines Detected">
              <div className="flex flex-col gap-2.5">
                {result.comboLines.map((combo, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(239,68,68,0.05)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
                        style={{
                          background: combo.speed === "early" ? "rgba(239,68,68,0.2)" : combo.speed === "mid" ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)",
                          color: combo.speed === "early" ? "#EF4444" : combo.speed === "mid" ? "#F59E0B" : "#22C55E",
                        }}
                      >
                        {combo.speed}
                      </span>
                      <span className="text-xs text-white/50">{combo.cards.join(" + ")}</span>
                    </div>
                    <p className="text-[11px] text-white/35">{combo.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Upgrade Paths ── */}
          {result.upgradePaths?.length > 0 && (
            <Section title="Bracket-Aware Upgrade Paths">
              <div className="flex flex-col gap-4">
                {result.upgradePaths.map((path, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-white/70">{path.tier}</span>
                      <div className="flex items-center gap-1">
                        <BracketBadge bracket={path.currentBracket} />
                        <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                        <BracketBadge bracket={path.targetBracket} />
                      </div>
                    </div>

                    {path.warning && (
                      <div
                        className="rounded-lg px-3 py-2 mb-2 flex items-start gap-2"
                        style={{ background: "rgba(245,158,11,0.08)" }}
                      >
                        <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <p className="text-[11px] text-amber-400/70 leading-relaxed">{path.warning}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      {path.swaps.map((swap, j) => (
                        <div
                          key={j}
                          className="rounded-lg px-3 py-2 flex flex-col gap-1"
                          style={{ background: "rgba(255,255,255,0.03)" }}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-400/70 line-through">{swap.cut}</span>
                            <svg className="w-3 h-3 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                            <span className="text-green-400/80 font-medium">{swap.add}</span>
                          </div>
                          <p className="text-[11px] text-white/30">{swap.reason}</p>
                          {swap.bracketImpact && (
                            <p className="text-[10px] text-amber-400/50">{swap.bracketImpact}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Re-analyze */}
          <button
            onClick={analyze}
            disabled={loading}
            className="text-xs text-white/30 hover:text-white/50 transition-colors py-2 disabled:opacity-50"
          >
            Re-analyze deck
          </button>
        </div>
      )}
    </div>
  );
}
