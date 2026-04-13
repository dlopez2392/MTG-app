"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { useGameLog, computeStats } from "@/hooks/useGameLog";
import { useDecks } from "@/hooks/useDecks";
import { cn } from "@/lib/utils/cn";
import type { GameResult, GameEntry } from "@/types/game";

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function resultColor(r: GameResult) {
  return r === "win" ? "text-legal" : r === "loss" ? "text-banned" : "text-text-muted";
}
function resultBg(r: GameResult) {
  return r === "win" ? "bg-legal/15 border-legal/30" : r === "loss" ? "bg-banned/15 border-banned/30" : "bg-bg-hover border-border";
}
function resultLabel(r: GameResult) {
  return r === "win" ? "W" : r === "loss" ? "L" : "D";
}

// ── Log Entry Form ────────────────────────────────────────────────────────────
interface LogFormProps {
  decks: Array<{ id?: string; name: string }>;
  initial?: Partial<GameEntry>;
  onSave: (entry: Omit<GameEntry, "id">) => void;
  onCancel: () => void;
}

function LogForm({ decks, initial, onSave, onCancel }: LogFormProps) {
  const [deckName, setDeckName]     = useState(initial?.deckName ?? decks[0]?.name ?? "");
  const [deckId, setDeckId]         = useState(initial?.deckId ?? decks[0]?.id ?? "");
  const [result, setResult]         = useState<GameResult>(initial?.result ?? "win");
  const [playerCount, setPlayers]   = useState(initial?.playerCount ?? 4);
  const [format, setFormat]         = useState(initial?.format ?? "");
  const [notes, setNotes]           = useState(initial?.notes ?? "");
  const [opponents, setOpponents]   = useState(initial?.opponentNames ?? "");
  const [date, setDate]             = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );

  function handleDeckChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = decks.find((d) => d.id === e.target.value || d.name === e.target.value);
    setDeckId(selected?.id ?? "");
    setDeckName(selected?.name ?? e.target.value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deckName.trim()) return;
    onSave({
      date: new Date(date).toISOString(),
      deckId: deckId || undefined,
      deckName: deckName.trim(),
      result,
      format: format || undefined,
      playerCount,
      notes: notes.trim() || undefined,
      opponentNames: opponents.trim() || undefined,
    });
  }

  const RESULTS: GameResult[] = ["win", "loss", "draw"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Deck */}
      <div>
        <label className="text-xs text-text-muted font-medium block mb-1">Deck</label>
        {decks.length > 0 ? (
          <select
            value={deckId || deckName}
            onChange={handleDeckChange}
            className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/60 transition-colors"
          >
            {decks.map((d) => (
              <option key={d.id ?? d.name} value={d.id ?? d.name}>{d.name}</option>
            ))}
            <option value="">— Custom name —</option>
          </select>
        ) : null}
        {(decks.length === 0 || deckId === "") && (
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Deck name…"
            className="w-full mt-1 bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors"
            required
          />
        )}
      </div>

      {/* Result */}
      <div>
        <label className="text-xs text-text-muted font-medium block mb-1">Result</label>
        <div className="flex gap-2">
          {RESULTS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResult(r)}
              className={cn(
                "flex-1 py-2.5 rounded-lg border text-sm font-bold uppercase tracking-wide transition-all",
                result === r
                  ? r === "win"  ? "bg-legal/20 border-legal/50 text-legal"
                  : r === "loss" ? "bg-banned/20 border-banned/50 text-banned"
                                 : "bg-bg-hover border-border text-text-secondary"
                  : "bg-bg-card border-border text-text-muted hover:text-text-secondary"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Players + Format row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1">Players</label>
          <select
            value={playerCount}
            onChange={(e) => setPlayers(Number(e.target.value))}
            className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/60 transition-colors"
          >
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n} players</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted font-medium block mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/60 transition-colors"
          >
            <option value="">Any</option>
            {["commander", "standard", "modern", "legacy", "vintage", "pioneer", "pauper", "draft", "sealed"].map((f) => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="text-xs text-text-muted font-medium block mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/60 transition-colors"
        />
      </div>

      {/* Opponents (optional) */}
      <div>
        <label className="text-xs text-text-muted font-medium block mb-1">Opponents <span className="text-text-muted/60">(optional)</span></label>
        <input
          type="text"
          value={opponents}
          onChange={(e) => setOpponents(e.target.value)}
          placeholder="e.g. Yuriko, Atraxa, Sliver Queen"
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors"
        />
      </div>

      {/* Notes (optional) */}
      <div>
        <label className="text-xs text-text-muted font-medium block mb-1">Notes <span className="text-text-muted/60">(optional)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go? Key plays, combos, notes…"
          rows={3}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={!deckName.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-dark transition-colors disabled:opacity-40">
          Save
        </button>
      </div>
    </form>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function WinRateBar({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  const total = wins + losses + draws;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;
  const lPct = (losses / total) * 100;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5 w-full">
      {wPct > 0 && <div className="bg-legal rounded-full" style={{ width: `${wPct}%` }} />}
      {dPct > 0 && <div className="bg-text-muted rounded-full" style={{ width: `${dPct}%` }} />}
      {lPct > 0 && <div className="bg-banned rounded-full" style={{ width: `${lPct}%` }} />}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GamesPage() {
  const searchParams = useSearchParams();
  const { entries, addEntry, deleteEntry } = useGameLog();
  const { allDecks } = useDecks();
  const [showLog, setShowLog]       = useState(false);
  const [filterDeck, setFilterDeck] = useState<string>("all");
  const [view, setView]             = useState<"log" | "stats">("log");
  const [preselectedDeck, setPreselectedDeck] = useState<{ id?: string; name: string } | undefined>();

  // If coming from a deck page (?deck=NAME&deckId=ID), open log modal pre-filled
  useEffect(() => {
    const deckName = searchParams.get("deck");
    const deckId   = searchParams.get("deckId");
    if (deckName) {
      setPreselectedDeck({ id: deckId ?? undefined, name: deckName });
      setShowLog(true);
    }
  }, []);

  const deckOptions = useMemo(() => {
    const merged = [...allDecks.map((d) => ({ id: d.id, name: d.name }))];
    const fromEntries = [...new Set(entries.map((e) => e.deckName))];
    fromEntries.forEach((name) => {
      if (!merged.find((d) => d.name === name)) merged.push({ id: undefined, name });
    });
    if (preselectedDeck && !merged.find((d) => d.name === preselectedDeck.name)) {
      merged.unshift({ id: preselectedDeck.id, name: preselectedDeck.name });
    }
    return merged;
  }, [allDecks, entries, preselectedDeck]);

  const filtered = useMemo(() =>
    filterDeck === "all" ? entries : entries.filter((e) => e.deckName === filterDeck || e.deckId === filterDeck),
    [entries, filterDeck]
  );

  const totalWins   = filtered.filter((e) => e.result === "win").length;
  const totalLosses = filtered.filter((e) => e.result === "loss").length;
  const totalDraws  = filtered.filter((e) => e.result === "draw").length;
  const total       = filtered.length;
  const winRate     = total > 0 ? Math.round((totalWins / total) * 100) : 0;

  const deckStats = useMemo(() => computeStats(entries), [entries]);

  const ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Game Log"
        subtitle={total > 0 ? `${total} games · ${winRate}% win rate` : "Track your match results"}
        accent="#3B82F6"
        icon={ICON}
      />

      <PageContainer>
        {/* View toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex bg-bg-card border border-border rounded-lg p-0.5 gap-0.5">
            {(["log", "stats"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-semibold capitalize transition-colors",
                  view === v ? "bg-accent text-black" : "text-text-muted hover:text-text-secondary"
                )}>
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowLog(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-black text-sm font-bold hover:bg-accent-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Log Game
          </button>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            }
            title="No games logged yet"
            description="Tap 'Log Game' after each match to track your win rate and performance over time."
          />
        ) : view === "stats" ? (
          /* ── Stats view ── */
          <div className="space-y-4">
            {/* Overall summary */}
            <div className="bg-bg-card rounded-xl border border-border p-4">
              <p className="text-section-label text-text-muted mb-3">Overall</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-text-primary">{total}</p>
                  <p className="text-[10px] text-text-muted">Games</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-legal">{totalWins}</p>
                  <p className="text-[10px] text-text-muted">Wins</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-banned">{totalLosses}</p>
                  <p className="text-[10px] text-text-muted">Losses</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{winRate}%</p>
                  <p className="text-[10px] text-text-muted">Win Rate</p>
                </div>
              </div>
              <WinRateBar wins={totalWins} losses={totalLosses} draws={totalDraws} />
            </div>

            {/* Per-deck stats */}
            <p className="text-section-label text-text-muted">By Deck</p>
            <div className="flex flex-col gap-2">
              {deckStats.map((ds) => (
                <div key={ds.deckName} className="bg-bg-card rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary truncate">{ds.deckName}</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      ds.winRate >= 60 ? "text-legal" : ds.winRate >= 40 ? "text-accent" : "text-banned"
                    )}>
                      {ds.winRate}%
                    </span>
                  </div>
                  <WinRateBar wins={ds.wins} losses={ds.losses} draws={ds.draws} />
                  <div className="flex gap-3 mt-2 text-[10px] text-text-muted">
                    <span>{ds.total} games</span>
                    <span className="text-legal">{ds.wins}W</span>
                    <span className="text-banned">{ds.losses}L</span>
                    {ds.draws > 0 && <span>{ds.draws}D</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── Log view ── */
          <>
            {/* Deck filter */}
            {deckOptions.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none -mx-1 px-1">
                <button
                  onClick={() => setFilterDeck("all")}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                    filterDeck === "all"
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
                  )}
                >
                  All decks
                </button>
                {deckOptions.map((d) => (
                  <button
                    key={d.id ?? d.name}
                    onClick={() => setFilterDeck(d.id ?? d.name)}
                    className={cn(
                      "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                      filterDeck === (d.id ?? d.name)
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}

            {/* Summary strip for filtered view */}
            {total > 0 && (
              <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-bg-card rounded-xl border border-border">
                <WinRateBar wins={totalWins} losses={totalLosses} draws={totalDraws} />
                <span className="flex-shrink-0 text-xs text-text-muted tabular-nums">
                  {totalWins}W {totalLosses}L{totalDraws > 0 ? ` ${totalDraws}D` : ""} · {winRate}%
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {filtered.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 bg-bg-card rounded-xl border border-border px-3 py-2.5">
                  {/* Result badge */}
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-bold",
                    resultBg(entry.result), resultColor(entry.result)
                  )}>
                    {resultLabel(entry.result)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{entry.deckName}</span>
                      {entry.format && (
                        <span className="text-[9px] bg-bg-hover px-1.5 py-0.5 rounded text-text-muted uppercase font-bold tracking-wide flex-shrink-0">
                          {entry.format}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-text-muted">{entry.playerCount}p · {timeAgo(entry.date)}</span>
                      {entry.opponentNames && (
                        <span className="text-xs text-text-muted truncate">vs {entry.opponentNames}</span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">{entry.notes}</p>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="flex-shrink-0 p-1.5 text-text-muted hover:text-banned transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banned"
                    title="Delete entry"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {filtered.length === 0 && (
                <p className="text-center text-text-muted text-sm py-8">No games for this deck yet.</p>
              )}
            </div>
          </>
        )}
      </PageContainer>

      {/* Log game modal */}
      <Modal open={showLog} onClose={() => setShowLog(false)} title="Log Game">
        <LogForm
          decks={deckOptions}
          initial={preselectedDeck ? { deckName: preselectedDeck.name, deckId: preselectedDeck.id } : undefined}
          onSave={(entry) => { addEntry(entry); setShowLog(false); }}
          onCancel={() => setShowLog(false)}
        />
      </Modal>
    </>
  );
}
