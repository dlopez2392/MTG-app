"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { DeckCard } from "@/types/deck";

interface Props {
  cards: DeckCard[];
  deckName: string;
  format: string;
}

interface Upgrade {
  cut: string;
  add: string;
  reason: string;
}

interface CoachingResult {
  overallGrade: string;
  summary: string;
  manaBase: { grade: string; analysis: string; suggestions: string[] };
  curve: { grade: string; analysis: string; suggestions: string[] };
  cardQuality: { upgrades: Upgrade[] };
  synergy: { analysis: string; missingPieces: string[] };
  interaction: { grade: string; analysis: string; suggestions: string[] };
  topPriority: string[];
}

const GRADE_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  A: { bg: "rgba(34,197,94,0.12)", text: "#22C55E", glow: "rgba(34,197,94,0.2)" },
  B: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", glow: "rgba(59,130,246,0.2)" },
  C: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", glow: "rgba(245,158,11,0.2)" },
  D: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", glow: "rgba(239,68,68,0.2)" },
  F: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", glow: "rgba(239,68,68,0.3)" },
};

function GradeBadge({ grade, size = "sm" }: { grade: string; size?: "sm" | "lg" }) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.C;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-black rounded-lg",
        size === "lg" ? "w-12 h-12 text-2xl" : "w-7 h-7 text-sm"
      )}
      style={{
        background: colors.bg,
        color: colors.text,
        boxShadow: `0 0 16px ${colors.glow}, inset 0 0 12px ${colors.glow}`,
      }}
    >
      {grade}
    </span>
  );
}

function CoachSection({ title, grade, analysis, suggestions, children }: {
  title: string;
  grade?: string;
  analysis?: string;
  suggestions?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        {grade && <GradeBadge grade={grade} />}
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">{title}</h3>
      </div>
      {analysis && <p className="text-sm text-white/60 mb-2 leading-relaxed">{analysis}</p>}
      {suggestions && suggestions.length > 0 && (
        <ul className="flex flex-col gap-1.5 mt-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-white/50">
              <svg className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
              </svg>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

export default function DeckCoach({ cards, deckName, format }: Props) {
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deck-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckName,
          format: format || "commander",
          cards: cards.map((c) => ({
            name: c.name,
            quantity: c.quantity,
            category: c.category,
            manaCost: c.manaCost,
            cmc: c.cmc,
            typeLine: c.typeLine,
            rarity: c.rarity,
            priceUsd: c.priceUsd,
          })),
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
  }

  return (
    <div
      className="rounded-2xl p-[1px] overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.3) 0%, rgba(234,179,8,0.2) 50%, rgba(124,92,252,0.1) 100%)" }}
    >
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(124,92,252,0.4), rgba(234,179,8,0.2))",
              boxShadow: "0 0 20px rgba(124,92,252,0.2)",
            }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider">AI Deck Coach</h2>
            <p className="text-[10px] text-white/30">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>

        {!result && !loading && (
          <div className="text-center py-4">
            <p className="text-xs text-white/40 mb-4 max-w-xs mx-auto leading-relaxed">
              Get AI-powered analysis of your deck — mana base, curve, card upgrades, synergy gaps, and priority fixes.
            </p>
            <button
              onClick={analyze}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #7C5CFC, #6347E0)",
                color: "white",
                boxShadow: "0 4px 20px rgba(124,92,252,0.4)",
              }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Analyze My Deck
              </span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
              <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
            <p className="text-xs text-white/40 animate-pulse">Analyzing {cards.length} cards...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 mb-4">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={analyze}
              className="mt-2 text-xs text-red-400/70 hover:text-red-400 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            {/* Overall grade + summary */}
            <div
              className="flex items-center gap-4 rounded-xl p-4"
              style={{
                background: GRADE_COLORS[result.overallGrade]?.bg ?? "rgba(255,255,255,0.05)",
                boxShadow: `inset 0 0 24px ${GRADE_COLORS[result.overallGrade]?.glow ?? "transparent"}`,
              }}
            >
              <GradeBadge grade={result.overallGrade} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80">Overall Grade</p>
                <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{result.summary}</p>
              </div>
            </div>

            {/* Top priority changes */}
            {result.topPriority?.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(124,92,252,0.06)", boxShadow: "inset 0 0 16px rgba(124,92,252,0.04)" }}
              >
                <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Top Priority Changes</h3>
                <ol className="flex flex-col gap-2">
                  {result.topPriority.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(124,92,252,0.2)", color: "#A78BFA" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs text-white/60 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Analysis sections */}
            <CoachSection
              title="Mana Base"
              grade={result.manaBase?.grade}
              analysis={result.manaBase?.analysis}
              suggestions={result.manaBase?.suggestions}
            />

            <CoachSection
              title="Mana Curve"
              grade={result.curve?.grade}
              analysis={result.curve?.analysis}
              suggestions={result.curve?.suggestions}
            />

            {/* Card upgrades */}
            {result.cardQuality?.upgrades?.length > 0 && (
              <CoachSection title="Card Upgrades">
                <div className="flex flex-col gap-2">
                  {result.cardQuality.upgrades.map((u, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400/70 line-through">{u.cut}</span>
                        <svg className="w-3 h-3 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                        <span className="text-green-400/80 font-medium">{u.add}</span>
                      </div>
                      <p className="text-[11px] text-white/30">{u.reason}</p>
                    </div>
                  ))}
                </div>
              </CoachSection>
            )}

            <CoachSection
              title="Synergy & Strategy"
              analysis={result.synergy?.analysis}
            >
              {result.synergy?.missingPieces?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Consider Adding</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.synergy.missingPieces.map((card) => (
                      <span
                        key={card}
                        className="px-2 py-1 rounded-md text-[11px] text-accent/80 font-medium"
                        style={{ background: "rgba(124,92,252,0.1)" }}
                      >
                        {card}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CoachSection>

            <CoachSection
              title="Interaction & Removal"
              grade={result.interaction?.grade}
              analysis={result.interaction?.analysis}
              suggestions={result.interaction?.suggestions}
            />

            {/* Re-analyze button */}
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
    </div>
  );
}
