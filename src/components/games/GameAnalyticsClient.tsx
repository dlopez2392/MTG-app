"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import GameInsights from "@/components/games/GameInsights";
import { useGameLog, computeStats } from "@/hooks/useGameLog";
import { cn } from "@/lib/utils/cn";
import { computeStreak } from "@/lib/utils/gameStats";
import type { GameEntry } from "@/types/game";

function GlassSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)" }}>
      <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass-card rounded-xl border border-border p-3 text-center">
      <p className={cn("text-xl font-bold tabular-nums", color ?? "text-text-primary")}>{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-text-muted/60 mt-0.5">{sub}</p>}
    </div>
  );
}

interface WinTrendPoint {
  label: string;
  winRate: number;
  games: number;
}

function computeWinTrend(entries: GameEntry[]): WinTrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const monthly = new Map<string, { wins: number; total: number }>();

  for (const e of sorted) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthly.has(key)) monthly.set(key, { wins: 0, total: 0 });
    const m = monthly.get(key)!;
    m.total++;
    if (e.result === "win") m.wins++;
  }

  return Array.from(monthly.entries()).map(([key, { wins, total }]) => ({
    label: key,
    winRate: Math.round((wins / total) * 100),
    games: total,
  }));
}

interface FormatStat {
  format: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
}

function computeFormatStats(entries: GameEntry[]): FormatStat[] {
  const map = new Map<string, FormatStat>();
  for (const e of entries) {
    const fmt = e.format || "Unspecified";
    if (!map.has(fmt)) map.set(fmt, { format: fmt, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 });
    const s = map.get(fmt)!;
    s.total++;
    if (e.result === "win") s.wins++;
    else if (e.result === "loss") s.losses++;
    else s.draws++;
  }
  for (const s of map.values()) {
    s.winRate = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

interface OpponentStat {
  name: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

function computeOpponentStats(entries: GameEntry[]): OpponentStat[] {
  const map = new Map<string, OpponentStat>();
  for (const e of entries) {
    if (!e.opponentNames) continue;
    const opponents = e.opponentNames.split(",").map((n) => n.trim()).filter(Boolean);
    for (const opp of opponents) {
      const key = opp.toLowerCase();
      if (!map.has(key)) map.set(key, { name: opp, wins: 0, losses: 0, total: 0, winRate: 0 });
      const s = map.get(key)!;
      s.total++;
      if (e.result === "win") s.wins++;
      else if (e.result === "loss") s.losses++;
    }
  }
  for (const s of map.values()) {
    s.winRate = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

interface PlayerCountStat {
  playerCount: number;
  wins: number;
  total: number;
  winRate: number;
}

function computePlayerCountStats(entries: GameEntry[]): PlayerCountStat[] {
  const map = new Map<number, PlayerCountStat>();
  for (const e of entries) {
    const pc = e.playerCount;
    if (!map.has(pc)) map.set(pc, { playerCount: pc, wins: 0, total: 0, winRate: 0 });
    const s = map.get(pc)!;
    s.total++;
    if (e.result === "win") s.wins++;
  }
  for (const s of map.values()) {
    s.winRate = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
  }
  return [...map.values()].sort((a, b) => a.playerCount - b.playerCount);
}

const CHART_COLORS = {
  accent: "#7C5CFC",
  green: "#22C55E",
  red: "#EF4444",
  muted: "rgba(255,255,255,0.15)",
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.4)",
};

export default function GameAnalyticsClient() {
  const router = useRouter();
  const { entries, loading } = useGameLog();

  const deckStats = useMemo(() => computeStats(entries), [entries]);
  const winTrend = useMemo(() => computeWinTrend(entries), [entries]);
  const formatStats = useMemo(() => computeFormatStats(entries), [entries]);
  const opponentStats = useMemo(() => computeOpponentStats(entries), [entries]);
  const playerCountStats = useMemo(() => computePlayerCountStats(entries), [entries]);
  const streak = useMemo(() => computeStreak(entries), [entries]);

  const totalGames = entries.length;
  const totalWins = entries.filter((e) => e.result === "win").length;
  const totalLosses = entries.filter((e) => e.result === "loss").length;
  const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  const bestDeck = deckStats.filter((d) => d.total >= 3).sort((a, b) => b.winRate - a.winRate)[0];
  const worstDeck = deckStats.filter((d) => d.total >= 3).sort((a, b) => a.winRate - b.winRate)[0];
  const mostPlayed = deckStats[0];

  const recentEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const recentWins = recentEntries.filter((e) => e.result === "win").length;
  const recentWinRate = recentEntries.length > 0 ? Math.round((recentWins / recentEntries.length) * 100) : 0;

  if (loading) {
    return (
      <>
        <TopBar title="Game Analytics" showBack />
        <PageContainer>
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        </PageContainer>
      </>
    );
  }

  if (totalGames === 0) {
    return (
      <>
        <TopBar title="Game Analytics" showBack />
        <PageContainer>
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">No games logged yet. Start logging games to see analytics.</p>
            <button onClick={() => router.push("/games")} className="mt-3 px-4 py-2 rounded-xl btn-gradient text-sm font-bold">
              Log a Game
            </button>
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <TopBar title="Game Analytics" showBack />
      <PageContainer>
        <div className="flex flex-col gap-4 pb-8">

          {/* ── Overview Cards ── */}
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Games" value={totalGames} />
            <StatCard label="Win Rate" value={`${overallWinRate}%`} color={overallWinRate >= 50 ? "text-legal" : "text-banned"} />
            <StatCard label="Wins" value={totalWins} color="text-legal" />
            <StatCard label="Losses" value={totalLosses} color="text-banned" />
          </div>

          {/* ── Streaks & Recent ── */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Current"
              value={streak.current > 0 ? `${streak.current}${streak.type === "win" ? "W" : "L"}` : "—"}
              color={streak.type === "win" ? "text-legal" : streak.type === "loss" ? "text-banned" : undefined}
            />
            <StatCard label="Best Streak" value={`${streak.best}W`} color="text-legal" />
            <StatCard
              label="Last 10"
              value={`${recentWinRate}%`}
              sub={`${recentWins}W-${recentEntries.length - recentWins}L`}
              color={recentWinRate >= 50 ? "text-legal" : "text-banned"}
            />
          </div>

          {/* ── AI Game Insights ── */}
          {totalGames >= 3 && <GameInsights entries={entries} />}

          {/* ── Win Rate Trend ── */}
          {winTrend.length >= 2 && (
            <GlassSection title="Win Rate Trend">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={winTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: CHART_COLORS.text }}
                    tickFormatter={(v: string) => { const [, m] = v.split("-"); const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return months[parseInt(m) - 1] ?? v; }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: CHART_COLORS.text }}
                    tickFormatter={(v: number) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                    formatter={(value) => [`${value}%`, "Win Rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="winRate"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2}
                    dot={{ r: 4, fill: CHART_COLORS.accent }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </GlassSection>
          )}

          {/* ── Format Performance ── */}
          {formatStats.length > 0 && (
            <GlassSection title="Format Performance">
              {formatStats.length >= 2 ? (
                <ResponsiveContainer width="100%" height={Math.max(120, formatStats.length * 36)}>
                  <BarChart data={formatStats} layout="vertical" barCategoryGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: CHART_COLORS.text }} tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="format" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(value) => [`${value}%`, "Win Rate"]} />
                    <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                      {formatStats.map((f, i) => (
                        <Cell key={i} fill={f.winRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red} opacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="space-y-2">
                  {formatStats.map((f) => (
                    <div key={f.format} className="flex items-center justify-between text-sm">
                      <span className="text-white/70 capitalize">{f.format}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted">{f.total} games</span>
                        <span className={cn("font-bold tabular-nums", f.winRate >= 50 ? "text-legal" : "text-banned")}>{f.winRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassSection>
          )}

          {/* ── Best / Worst Decks ── */}
          {(bestDeck || mostPlayed) && (
            <GlassSection title="Deck Highlights">
              <div className="space-y-2.5">
                {bestDeck && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-legal bg-legal/10 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">Best</span>
                      <span className="text-sm text-white/80 truncate">{bestDeck.deckName}</span>
                    </div>
                    <span className="text-sm font-bold text-legal tabular-nums flex-shrink-0">{bestDeck.winRate}% <span className="text-xs text-text-muted font-normal">({bestDeck.total}g)</span></span>
                  </div>
                )}
                {worstDeck && worstDeck !== bestDeck && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-banned bg-banned/10 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">Worst</span>
                      <span className="text-sm text-white/80 truncate">{worstDeck.deckName}</span>
                    </div>
                    <span className="text-sm font-bold text-banned tabular-nums flex-shrink-0">{worstDeck.winRate}% <span className="text-xs text-text-muted font-normal">({worstDeck.total}g)</span></span>
                  </div>
                )}
                {mostPlayed && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">Fav</span>
                      <span className="text-sm text-white/80 truncate">{mostPlayed.deckName}</span>
                    </div>
                    <span className="text-sm font-bold text-accent tabular-nums flex-shrink-0">{mostPlayed.total} games</span>
                  </div>
                )}
              </div>
            </GlassSection>
          )}

          {/* ── Player Count Performance ── */}
          {playerCountStats.length > 1 && (
            <GlassSection title="Performance by Player Count">
              <div className="grid grid-cols-2 gap-2">
                {playerCountStats.map((pc) => (
                  <div key={pc.playerCount} className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <span className="text-sm text-white/70">{pc.playerCount}-player</span>
                      <span className="text-[10px] text-text-muted ml-1.5">({pc.total}g)</span>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums", pc.winRate >= 50 ? "text-legal" : "text-banned")}>{pc.winRate}%</span>
                  </div>
                ))}
              </div>
            </GlassSection>
          )}

          {/* ── Most Played Opponents ── */}
          {opponentStats.length > 0 && (
            <GlassSection title="Opponent Records">
              <div className="space-y-2">
                {opponentStats.slice(0, 10).map((opp) => (
                  <div key={opp.name} className="flex items-center justify-between">
                    <span className="text-sm text-white/70 truncate flex-1 mr-3">{opp.name}</span>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="text-xs text-text-muted tabular-nums">{opp.total}g</span>
                      <span className="text-xs text-legal tabular-nums font-semibold">{opp.wins}W</span>
                      <span className="text-xs text-banned tabular-nums font-semibold">{opp.losses}L</span>
                      <span className={cn("text-xs font-bold tabular-nums w-8 text-right", opp.winRate >= 50 ? "text-legal" : "text-banned")}>{opp.winRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassSection>
          )}

          {/* ── All Decks Breakdown ── */}
          {deckStats.length > 0 && (
            <GlassSection title="All Decks">
              <div className="space-y-2">
                {deckStats.map((d) => (
                  <div key={d.deckId ?? d.deckName} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white/80 truncate">{d.deckName}</span>
                      <span className={cn("text-xs font-bold tabular-nums", d.winRate >= 50 ? "text-legal" : "text-banned")}>{d.winRate}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/40 mb-1.5">
                      <span>{d.total} games</span>
                      <span className="text-green-400/70">{d.wins}W</span>
                      <span className="text-red-400/70">{d.losses}L</span>
                      {d.draws > 0 && <span>{d.draws}D</span>}
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                      {d.wins > 0 && <div className="rounded-full bg-legal" style={{ width: `${(d.wins / d.total) * 100}%` }} />}
                      {d.losses > 0 && <div className="rounded-full bg-banned" style={{ width: `${(d.losses / d.total) * 100}%` }} />}
                      {d.draws > 0 && <div className="rounded-full bg-white/20" style={{ width: `${(d.draws / d.total) * 100}%` }} />}
                    </div>
                  </div>
                ))}
              </div>
            </GlassSection>
          )}
        </div>
      </PageContainer>
    </>
  );
}
