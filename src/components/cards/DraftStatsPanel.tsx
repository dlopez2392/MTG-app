"use client";

import { useEffect, useState } from "react";

interface DraftStats {
  avgSeen: number | null;
  avgPick: number | null;
  gameCount: number | null;
  winRate: number | null;
  openingHandWinRate: number | null;
  drawnWinRate: number | null;
  everDrawnWinRate: number | null;
  neverDrawnWinRate: number | null;
  drawnImprovementWinRate: number | null;
}

interface DraftStatsResponse {
  format?: string;
  set?: string;
  stats: DraftStats | null;
}

interface DraftStatsPanelProps {
  cardName: string;
  setCode: string;
}

function pct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function num(val: number | null, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function WinRateBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  const pctVal = value * 100;
  const color =
    pctVal >= 58 ? "bg-legal" :
    pctVal >= 54 ? "bg-accent" :
    pctVal >= 50 ? "bg-yellow-500" :
    "bg-banned";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(pctVal, 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums text-text-primary w-10 text-right">
        {pct(value)}
      </span>
    </div>
  );
}

const FORMAT_LABELS: Record<string, string> = {
  PremierDraft: "Premier Draft",
  QuickDraft: "Quick Draft",
  TradDraft: "Traditional Draft",
};

export default function DraftStatsPanel({ cardName, setCode }: DraftStatsPanelProps) {
  const [data, setData] = useState<DraftStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/17lands?set=${encodeURIComponent(setCode)}&name=${encodeURIComponent(cardName)}`)
      .then((r) => r.json())
      .then((d: DraftStatsResponse) => setData(d))
      .catch(() => setData({ stats: null }))
      .finally(() => setLoading(false));
  }, [cardName, setCode]);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-bg-hover rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data?.stats) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-6 text-center">
        <p className="text-sm text-text-muted">No draft data available for this card.</p>
        <p className="text-xs text-text-muted mt-1 opacity-60">
          17Lands only tracks sets available on MTG Arena.
        </p>
      </div>
    );
  }

  const { stats, format } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Source: <span className="text-accent">17Lands</span> · {FORMAT_LABELS[format ?? ""] ?? format} · {stats.gameCount?.toLocaleString() ?? "—"} games
        </p>
        <span className="text-[10px] text-text-muted italic">CC BY 4.0</span>
      </div>

      {/* Pick stats */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 bg-bg-hover border-b border-border">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Pick Order</p>
        </div>
        <div className="divide-y divide-border">
          <div className="grid grid-cols-2 px-3 py-2.5">
            <span className="text-sm text-text-secondary">ALSA (Avg Last Seen At)</span>
            <span className="text-sm font-mono tabular-nums text-text-primary text-right">{num(stats.avgSeen)}</span>
          </div>
          <div className="grid grid-cols-2 px-3 py-2.5">
            <span className="text-sm text-text-secondary">ATA (Avg Taken At)</span>
            <span className="text-sm font-mono tabular-nums text-text-primary text-right">{num(stats.avgPick)}</span>
          </div>
        </div>
      </div>

      {/* Win rates */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 bg-bg-hover border-b border-border">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Win Rates</p>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: "GIH WR (Games In Hand)", value: stats.everDrawnWinRate },
            { label: "OH WR (Opening Hand)", value: stats.openingHandWinRate },
            { label: "GD WR (Games Drawn)", value: stats.drawnWinRate },
            { label: "GNS WR (Games Not Seen)", value: stats.neverDrawnWinRate },
          ].map(({ label, value }) => (
            <div key={label} className="px-3 py-2.5">
              <p className="text-xs text-text-muted mb-1">{label}</p>
              <WinRateBar value={value} />
            </div>
          ))}
        </div>
      </div>

      {/* IWD */}
      <div className="rounded-xl border border-border px-3 py-2.5">
        <div className="grid grid-cols-2">
          <span className="text-sm text-text-secondary">IWD (Improvement When Drawn)</span>
          <span className={`text-sm font-mono tabular-nums text-right ${
            (stats.drawnImprovementWinRate ?? 0) >= 0 ? "text-legal" : "text-banned"
          }`}>
            {stats.drawnImprovementWinRate !== null
              ? `${(stats.drawnImprovementWinRate * 100) >= 0 ? "+" : ""}${pct(stats.drawnImprovementWinRate)}`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
