"use client";

import { cn } from "@/lib/utils/cn";
import type { Match } from "@/types/match";

interface MatchHistoryProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MatchHistory({ matches, loading, error }: MatchHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <svg className="w-12 h-12 mx-auto text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-text-muted text-sm">No matches recorded yet</p>
        <p className="text-text-muted text-xs">Finish a game and save it to see your history here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const winner = match.players.find((p) => p.isWinner);
        return (
          <div key={match.id} className="bg-bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">
                  {match.playerCount}P
                </span>
                <span className="text-xs text-text-muted">·</span>
                <span className="text-xs text-text-muted">{match.startingLife} life</span>
                {match.format && (
                  <>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-accent font-medium">{match.format}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>{formatDuration(match.durationSecs)}</span>
                <span>·</span>
                <span>{formatDate(match.startedAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {match.players.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs",
                    p.isWinner
                      ? "bg-accent/20 border border-accent/40"
                      : "bg-bg-hover border border-transparent"
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className={cn("font-semibold", p.isWinner ? "text-accent" : "text-text-primary")}>
                    {p.playerName}
                  </span>
                  <span className={cn("tabular-nums", p.finalLife <= 0 ? "text-red-400" : "text-text-muted")}>
                    {p.finalLife}
                  </span>
                  {p.isWinner && (
                    <svg className="w-3.5 h-3.5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 3v2l4 4-2.5 3.5L3 11v2l4 2 1 6h2l1-6 1.5-2L14 19h2l1-6 4-2v-2l-3.5 1.5L15 7l4-4V1l-5 5-2-2-2 2-5-5z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {match.notes && (
              <p className="text-xs text-text-muted italic">{match.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
