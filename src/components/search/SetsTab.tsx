"use client";

import { useState, useEffect, useMemo } from "react";
import type { ScryfallSet } from "@/types/card";

interface SetsTabProps {
  onSetSelect: (set: ScryfallSet) => void;
}

const SET_TYPE_ORDER = [
  "expansion", "core", "masters", "draft_innovation", "commander",
  "starter", "box", "funny", "masterpiece", "memorabilia", "promo",
  "token", "minigame", "treasure_chest", "alchemy", "archenemy",
  "planechase", "vanguard",
];

function sortSets(sets: ScryfallSet[]): ScryfallSet[] {
  return [...sets].sort((a, b) => {
    const dateA = a.released_at ?? "";
    const dateB = b.released_at ?? "";
    return dateB.localeCompare(dateA);
  });
}

export default function SetsTab({ onSetSelect }: SetsTabProps) {
  const [sets, setSets] = useState<ScryfallSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/scryfall/sets")
      .then((r) => r.json())
      .then((body) => {
        if (body.data) setSets(sortSets(body.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return sets;
    const q = query.toLowerCase();
    return sets.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [sets, query]);

  function handleSetClick(set: ScryfallSet) {
    onSetSelect(set);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a set…"
          className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-text-muted">
          <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm">No sets found</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {filtered.map((set, i) => (
            <button
              key={set.id}
              onClick={() => handleSetClick(set)}
              className={`flex items-center gap-3 px-1 py-3 text-left active:bg-bg-hover transition-colors ${
                i !== 0 ? "border-t border-border/50" : ""
              }`}
            >
              {/* Set icon */}
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={set.icon_svg_uri}
                  alt=""
                  aria-hidden
                  className="w-7 h-7 object-contain"
                  style={{ filter: "invert(1) opacity(0.7)" }}
                />
              </div>

              {/* Name + card count */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary leading-tight">
                  {set.name}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {set.card_count.toLocaleString()} card{set.card_count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Release date */}
              {set.released_at && (
                <span className="text-xs text-text-muted shrink-0 tabular-nums">
                  {set.released_at}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
