"use client";

import { useState } from "react";
import type { DeckCard } from "@/types/deck";

interface Props {
  cards: DeckCard[];
  deckName: string;
}

interface Combo {
  name: string;
  cards: string[];
  type: "infinite" | "synergy" | "value";
  description: string;
  steps: string[];
  result: string;
  difficulty: "easy" | "medium" | "hard";
  notes?: string;
}

interface MissingPiece {
  combo: string;
  have: string[];
  need: string;
  reason: string;
}

interface ComboResult {
  combos: Combo[];
  summary: string;
  missingPieces?: MissingPiece[];
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  infinite: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", label: "Infinite" },
  synergy: { bg: "rgba(124,92,252,0.12)", text: "#7C5CFC", label: "Synergy" },
  value: { bg: "rgba(34,197,94,0.12)", text: "#22C55E", label: "Value" },
};

const DIFF_STYLES: Record<string, { text: string; label: string }> = {
  easy: { text: "#22C55E", label: "Easy" },
  medium: { text: "#F59E0B", label: "Medium" },
  hard: { text: "#EF4444", label: "Hard" },
};

export default function ComboDiscovery({ cards, deckName }: Props) {
  const [result, setResult] = useState<ComboResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/combo-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckName,
          cards: cards.map((c) => ({
            name: c.name,
            quantity: c.quantity,
            typeLine: c.typeLine,
            manaCost: c.manaCost,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="rounded-2xl p-[1px] overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(236,72,153,0.05))" }}
    >
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(15,15,25,0.95) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(236,72,153,0.1))" }}
          >
            <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Combo Discovery</h2>
        </div>

        {!result && !loading && (
          <>
            <p className="text-xs text-white/40 mb-4">AI analyzes your decklist for infinite combos, synergy chains, and near-miss combos that are 1 card away.</p>
            <button
              onClick={analyze}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, rgba(236,72,153,0.5), rgba(168,85,247,0.5))",
                boxShadow: "0 4px 16px rgba(236,72,153,0.2)",
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Discover Combos
            </button>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/50">Analyzing card interactions...</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={analyze} className="mt-2 text-xs text-accent underline">Try again</button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-white/60 leading-relaxed">{result.summary}</p>

            {result.combos.length === 0 && (
              <p className="text-sm text-white/40 text-center py-4">No combos found in this decklist.</p>
            )}

            {result.combos.map((combo, i) => {
              const ts = TYPE_STYLES[combo.type] ?? TYPE_STYLES.synergy;
              const ds = DIFF_STYLES[combo.difficulty] ?? DIFF_STYLES.medium;
              const expanded = expandedCombo === i;

              return (
                <button
                  key={i}
                  onClick={() => setExpandedCombo(expanded ? null : i)}
                  className="w-full text-left rounded-xl p-4 transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: ts.bg, color: ts.text }}
                    >
                      {ts.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/90">{combo.name}</p>
                      <p className="text-xs text-white/50 mt-1">{combo.cards.join(" + ")}</p>
                    </div>
                    <span className="text-[10px] font-medium flex-shrink-0" style={{ color: ds.text }}>
                      {ds.label}
                    </span>
                  </div>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-white/60 mb-2">{combo.description}</p>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Steps</p>
                      <ol className="flex flex-col gap-1.5">
                        {combo.steps.map((step, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-white/50">
                            <span className="text-accent font-bold flex-shrink-0">{j + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="text-xs text-pink-400 font-medium mt-2">{combo.result}</p>
                      {combo.notes && <p className="text-[11px] text-white/30 mt-1.5 italic">{combo.notes}</p>}
                    </div>
                  )}
                </button>
              );
            })}

            {result.missingPieces && result.missingPieces.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Almost there — 1 card away</p>
                {result.missingPieces.map((mp, i) => (
                  <div key={i} className="rounded-xl p-3 mb-2" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <p className="text-xs font-semibold text-amber-400">{mp.combo}</p>
                    <p className="text-[11px] text-white/50 mt-1">
                      Have: <span className="text-white/70">{mp.have.join(", ")}</span>
                    </p>
                    <p className="text-[11px] text-white/50">
                      Need: <span className="text-amber-300 font-medium">{mp.need}</span>
                    </p>
                    <p className="text-[11px] text-white/40 mt-1">{mp.reason}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => { setResult(null); setExpandedCombo(null); }}
              className="text-xs text-white/30 hover:text-white/50 transition-colors mt-1"
            >
              Run again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
