"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useDecks } from "@/hooks/useDecks";
import { useValueHistory } from "@/hooks/useValueHistory";
import { useGameLog } from "@/hooks/useGameLog";
import { computeStreak } from "@/lib/utils/gameStats";
import type { ScryfallSet } from "@/types/card";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late brewing";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Latest snapshot value + delta vs the closest snapshot ≥7 days older, if any. */
function valueMovement(history: { date: string; value: number }[]): { value: number; delta: number | null } | null {
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const past = [...history].reverse().find((s) => s.date <= cutoff);
  return { value: latest.value, delta: past ? latest.value - past.value : null };
}

/** Whole days between now and a future ISO date, floor 1. */
function daysUntil(isoDate: string): number {
  return Math.max(1, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000));
}

export default function DashboardStrip() {
  const { user, isLoaded } = useUser();
  const { allDecks, loading: decksLoading } = useDecks();
  const { history } = useValueHistory();
  const { entries, loading: gamesLoading } = useGameLog();
  const [nextSet, setNextSet] = useState<ScryfallSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scryfall/sets")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const today = new Date().toISOString().slice(0, 10);
        const sets: ScryfallSet[] = data.data ?? [];
        const upcoming = sets
          .filter((s) => (s.set_type === "expansion" || s.set_type === "core") && (s.released_at ?? "") > today)
          .sort((a, b) => (a.released_at ?? "").localeCompare(b.released_at ?? ""));
        setNextSet(upcoming[0] ?? null);
      })
      .catch(() => { /* card simply doesn't render */ });
    return () => { cancelled = true; };
  }, []);

  const recentDecks = decksLoading ? [] : [...(allDecks ?? [])]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 3);
  const movement = valueMovement(history);
  const streak = gamesLoading ? null : computeStreak(entries);
  const showStreak = streak !== null && streak.type === "win" && streak.current >= 2;
  const daysToSet = nextSet?.released_at ? daysUntil(nextSet.released_at) : null;

  const hasAnything = recentDecks.length > 0 || movement !== null || showStreak || nextSet !== null;
  if (!hasAnything) return null;

  return (
    <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
      {/* Greeting */}
      <p className="text-section-label text-text-muted mb-2">
        {greeting()}
        {isLoaded && user?.firstName ? `, ${user.firstName}` : ""}
      </p>

      {/* Stat chips row */}
      {(movement || showStreak || nextSet) && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {movement && (
            <Link
              href="/collection"
              className="glass-card border border-border rounded-xl px-3 py-2 shrink-0 hover:border-accent/40 transition-colors"
            >
              <p className="text-caption">Collection</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">
                ${movement.value.toFixed(2)}
                {movement.delta !== null && movement.delta !== 0 && (
                  <span className={`ml-1.5 text-xs font-semibold ${movement.delta > 0 ? "text-legal" : "text-banned"}`}>
                    {movement.delta > 0 ? "▲" : "▼"} ${Math.abs(movement.delta).toFixed(2)}
                  </span>
                )}
              </p>
            </Link>
          )}
          {showStreak && streak && (
            <Link
              href="/games/analytics"
              className="glass-card border border-legal/30 rounded-xl px-3 py-2 shrink-0 hover:border-legal/60 transition-colors"
            >
              <p className="text-caption">Win streak</p>
              <p className="text-sm font-bold text-legal tabular-nums">🔥 {streak.current} in a row</p>
            </Link>
          )}
          {nextSet && daysToSet !== null && (
            <Link
              href="/search"
              className="glass-card border border-border rounded-xl px-3 py-2 shrink-0 hover:border-accent/40 transition-colors"
            >
              <p className="text-caption">{nextSet.name}</p>
              <p className="text-sm font-bold text-accent tabular-nums">
                {daysToSet} day{daysToSet !== 1 ? "s" : ""} away
              </p>
            </Link>
          )}
        </div>
      )}

      {/* Recent decks */}
      {recentDecks.length > 0 && (
        <div className="grid grid-cols-3 gap-2 stagger-children">
          {recentDecks.map((deck) => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="relative glass-card border border-border rounded-xl overflow-hidden aspect-[3/2] hover:border-accent/40 transition-colors active:scale-[0.97]"
            >
              {deck.coverImageUri && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deck.coverImageUri}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 via-bg-primary/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-xs font-semibold text-text-primary truncate">{deck.name}</p>
                {deck.format && <p className="text-[10px] text-text-secondary capitalize">{deck.format}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
