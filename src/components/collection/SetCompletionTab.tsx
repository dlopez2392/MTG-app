"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { CollectionCard } from "@/types/collection";
import type { ScryfallSet } from "@/types/card";

interface SetCompletionTabProps {
  allCards: CollectionCard[];
}

type SortKey = "completion" | "name" | "released" | "owned";

// Set types we care about — skip tokens, memorabilia, promos, etc.
const RELEVANT_TYPES = new Set([
  "core", "expansion", "masters", "draft_innovation",
  "commander", "starter", "box", "funny", "archenemy",
  "planechase", "conspiracy",
]);

interface SetProgress {
  set: ScryfallSet;
  owned: number;    // unique collector numbers owned
  total: number;    // card_count from Scryfall
  pct: number;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-bg-hover overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

function completionColor(pct: number): string {
  if (pct >= 100) return "#F59E0B"; // gold
  if (pct >= 75)  return "#22C55E"; // green
  if (pct >= 40)  return "#3B82F6"; // blue
  return "#6B7280";                 // grey
}

export default function SetCompletionTab({ allCards }: SetCompletionTabProps) {
  const [sets, setSets]       = useState<ScryfallSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortKey>("completion");
  const [query, setQuery]     = useState("");

  // Fetch sets once
  useEffect(() => {
    fetch("/api/scryfall/sets")
      .then((r) => r.json())
      .then((d) => setSets(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build owned map: setCode → Set of collectorNumbers
  const ownedBySet = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const card of allCards) {
      if (!card.setCode) continue;
      const key = card.setCode.toLowerCase();
      if (!map.has(key)) map.set(key, new Set());
      if (card.collectorNumber) map.get(key)!.add(card.collectorNumber);
    }
    return map;
  }, [allCards]);

  // Merge sets with owned counts
  const progress = useMemo<SetProgress[]>(() => {
    return sets
      .filter((s) => RELEVANT_TYPES.has(s.set_type) && s.card_count > 0)
      .map((s) => {
        const owned = ownedBySet.get(s.code.toLowerCase())?.size ?? 0;
        const total = s.card_count;
        return { set: s, owned, total, pct: (owned / total) * 100 };
      })
      .filter((p) => p.owned > 0); // only show sets you have at least one card from
  }, [sets, ownedBySet]);

  // Sort & filter
  const sorted = useMemo(() => {
    let list = query
      ? progress.filter((p) =>
          p.set.name.toLowerCase().includes(query.toLowerCase()) ||
          p.set.code.toLowerCase().includes(query.toLowerCase())
        )
      : progress;

    switch (sort) {
      case "completion": return [...list].sort((a, b) => b.pct - a.pct);
      case "name":       return [...list].sort((a, b) => a.set.name.localeCompare(b.set.name));
      case "released":   return [...list].sort((a, b) =>
          (b.set.released_at ?? "").localeCompare(a.set.released_at ?? ""));
      case "owned":      return [...list].sort((a, b) => b.owned - a.owned);
    }
  }, [progress, sort, query]);

  const complete = progress.filter((p) => p.pct >= 100).length;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted text-sm">No set data yet.</p>
        <p className="text-text-muted/60 text-xs mt-1">Add cards to your collection with set info to track completion.</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Summary */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-xl font-bold text-text-primary">{progress.length}</p>
          <p className="text-[10px] text-text-muted">Sets Started</p>
        </div>
        <div className="flex-1 bg-bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-xl font-bold text-mtg-gold">{complete}</p>
          <p className="text-[10px] text-text-muted">Complete</p>
        </div>
        <div className="flex-1 bg-bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-xl font-bold text-accent">
            {progress.reduce((s, p) => s + p.owned, 0)}
          </p>
          <p className="text-[10px] text-text-muted">Unique Cards</p>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sets…"
          className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-bg-card border border-border rounded-lg px-2 py-2 text-xs text-text-secondary outline-none focus:border-accent/60 transition-colors"
        >
          <option value="completion">% Complete</option>
          <option value="owned">Most Owned</option>
          <option value="released">Newest First</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {/* Set list */}
      <div className="flex flex-col gap-2">
        {sorted.map(({ set, owned, total, pct }) => {
          const color = completionColor(pct);
          const isComplete = pct >= 100;
          return (
            <div
              key={set.code}
              className="flex items-center gap-3 bg-bg-card rounded-xl border border-border px-3 py-2.5"
            >
              {/* Set icon */}
              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                <Image
                  src={set.icon_svg_uri}
                  alt={set.name}
                  width={24}
                  height={24}
                  className="w-6 h-6 opacity-70"
                  style={{ filter: "invert(1) sepia(1) saturate(0) brightness(1.5)" }}
                />
              </div>

              {/* Name + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-primary truncate">{set.name}</span>
                  {isComplete && (
                    <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-mtg-gold/20 text-mtg-gold">
                      Complete
                    </span>
                  )}
                </div>
                <ProgressBar pct={pct} color={color} />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-text-muted uppercase tracking-wide">{set.code}</span>
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {owned} / {total}
                  </span>
                </div>
              </div>

              {/* Percent */}
              <div
                className="flex-shrink-0 text-sm font-bold tabular-nums w-12 text-right"
                style={{ color }}
              >
                {pct >= 100 ? "100%" : `${pct.toFixed(0)}%`}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && query && (
        <p className="text-center text-text-muted text-sm py-8">No sets match "{query}".</p>
      )}
    </div>
  );
}
