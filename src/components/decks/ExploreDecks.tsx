"use client";

import { useState, useEffect, useCallback } from "react";
import ManaSymbol from "@/components/cards/ManaSymbol";

interface ExploreDeck {
  id: string;
  name: string;
  format: string;
  colors: string[];
  viewCount: number;
  cardCount: number;
  owner: string;
  featuredArt: string | null;
  source: string;
  sourceUrl: string;
  updatedAt: string;
}

interface ExploreResult {
  decks: ExploreDeck[];
  totalCount: number;
  hasMore: boolean;
  page: number;
}

const FORMATS = [
  { value: "commander", label: "Commander" },
  { value: "standard", label: "Standard" },
  { value: "modern", label: "Modern" },
  { value: "pioneer", label: "Pioneer" },
  { value: "pauper", label: "Pauper" },
  { value: "legacy", label: "Legacy" },
];

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ExploreCard({ deck }: { deck: ExploreDeck }) {
  return (
    <a
      href={deck.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-bg-card group block transition-transform duration-150 hover:scale-[1.03] active:scale-100"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
    >
      {deck.featuredArt ? (
        <img src={deck.featuredArt} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-bg-card to-bg-hover flex items-center justify-center">
          <svg className="w-10 h-10 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* Source + views badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white/70 font-medium uppercase tracking-wider">
          Archidekt
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white/50 font-medium flex items-center gap-0.5">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          {formatViews(deck.viewCount)}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-white font-bold text-xs uppercase tracking-wide truncate leading-tight">
            {deck.name}
          </p>
          <p className="text-[10px] text-white/50 truncate mt-0.5">
            by {deck.owner}
          </p>
        </div>

        {deck.colors.length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0">
            {deck.colors.map((c) => (
              <ManaSymbol key={c} symbol={c} size={16} className="drop-shadow-sm" />
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

export default function ExploreDecks() {
  const [format, setFormat] = useState("commander");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [decks, setDecks] = useState<ExploreDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDecks = useCallback(async (p: number, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format, page: String(p) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/explore-decks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ExploreResult = await res.json();
      setDecks((prev) => append ? [...prev, ...data.decks] : data.decks);
      setHasMore(data.hasMore);
      setPage(data.page);
    } catch {
      setError("Couldn't load explore decks. Try again later.");
      if (!append) setDecks([]);
    } finally {
      setLoading(false);
    }
  }, [format, debouncedSearch]);

  useEffect(() => {
    fetchDecks(1);
  }, [fetchDecks]);

  return (
    <div className="space-y-4">
      {/* Format chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFormat(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              format === f.value
                ? "btn-gradient"
                : "bg-bg-card text-text-secondary hover:text-text-primary border border-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search popular decks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-primary border border-border text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors"
        />
      </div>

      {/* Results */}
      {error ? (
        <div className="text-center py-8">
          <p className="text-text-muted text-sm">{error}</p>
          <button
            onClick={() => fetchDecks(1)}
            className="mt-3 px-4 py-2 rounded-xl btn-gradient text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      ) : loading && decks.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-muted text-sm">No decks found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {decks.map((deck) => (
              <ExploreCard key={deck.id} deck={deck} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={() => fetchDecks(page + 1, true)}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
