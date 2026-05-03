"use client";

import { useState } from "react";
import type { GameEntry } from "@/types/game";

interface Props {
  entries: GameEntry[];
}

interface Insight {
  title: string;
  category: "matchup" | "deck" | "trend" | "strategy" | "meta";
  severity: "strength" | "neutral" | "weakness";
  finding: string;
  advice: string;
}

interface DeckRec {
  deckName: string;
  verdict: "keep" | "tune" | "retire";
  reason: string;
}

interface InsightsResult {
  overallAssessment: string;
  insights: Insight[];
  deckRecommendations?: DeckRec[];
  focus: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; color: string }> = {
  strength: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", icon: "↑", color: "#22C55E" },
  neutral: { bg: "rgba(124,92,252,0.08)", border: "rgba(124,92,252,0.2)", icon: "→", color: "#7C5CFC" },
  weakness: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", icon: "↓", color: "#EF4444" },
};

const CATEGORY_LABELS: Record<string, string> = {
  matchup: "Matchup",
  deck: "Deck",
  trend: "Trend",
  strategy: "Strategy",
  meta: "Meta",
};

const VERDICT_STYLES: Record<string, { color: string; label: string }> = {
  keep: { color: "#22C55E", label: "Keep" },
  tune: { color: "#F59E0B", label: "Tune" },
  retire: { color: "#EF4444", label: "Retire" },
};

export default function GameInsights({ entries }: Props) {
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/game-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: entries.map((e) => ({
            date: e.date,
            deckName: e.deckName,
            result: e.result,
            format: e.format,
            playerCount: e.playerCount,
            notes: e.notes,
            opponentNames: e.opponentNames,
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
      style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.05))" }}
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
            style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))" }}
          >
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">AI Game Insights</h2>
        </div>

        {!result && !loading && (
          <>
            <p className="text-xs text-white/40 mb-4">
              AI analyzes your game history to find patterns, weak matchups, and advice to improve your win rate.
            </p>
            <button
              onClick={analyze}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, rgba(124,92,252,0.5), rgba(99,102,241,0.5))",
                boxShadow: "0 4px 16px rgba(124,92,252,0.2)",
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Analyze My Games
            </button>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/50">Analyzing your game history...</span>
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
            <p className="text-sm text-white/60 leading-relaxed">{result.overallAssessment}</p>

            {result.insights.map((insight, i) => {
              const ss = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.neutral;
              const catLabel = CATEGORY_LABELS[insight.category] ?? insight.category;

              return (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{ background: ss.bg, border: `1px solid ${ss.border}` }}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg leading-none mt-0.5" style={{ color: ss.color }}>{ss.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white/90">{insight.title}</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: ss.color, background: `${ss.color}15` }}>
                          {catLabel}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{insight.finding}</p>
                      <p className="text-xs text-white/80 mt-1.5 font-medium">{insight.advice}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {result.deckRecommendations && result.deckRecommendations.length > 0 && (
              <div className="mt-1">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Deck Verdicts</p>
                <div className="flex flex-col gap-1.5">
                  {result.deckRecommendations.map((rec, i) => {
                    const vs = VERDICT_STYLES[rec.verdict] ?? VERDICT_STYLES.tune;
                    return (
                      <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: vs.color, background: `${vs.color}15` }}>
                            {vs.label}
                          </span>
                          <span className="text-sm text-white/80 truncate">{rec.deckName}</span>
                        </div>
                        <span className="text-[11px] text-white/40 ml-2 flex-shrink-0 text-right max-w-[50%]">{rec.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl p-3 mt-1" style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.2)" }}>
              <p className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1">Top Priority</p>
              <p className="text-sm text-white/80 leading-relaxed">{result.focus}</p>
            </div>

            <button
              onClick={() => setResult(null)}
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
