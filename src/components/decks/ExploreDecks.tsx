"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ManaSymbol from "@/components/cards/ManaSymbol";
import { cn } from "@/lib/utils/cn";

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

const SOURCES = [
  { key: "archidekt", label: "Archidekt", color: "#8B5CF6", importable: true },
  { key: "moxfield", label: "Moxfield", color: "#3B82F6", importable: true },
  { key: "edhrec", label: "EDHREC", color: "#22C55E", importable: false },
  { key: "mtgtop8", label: "MTGTop8", color: "#F59E0B", importable: false },
];

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

function sourceLabel(source: string) {
  return SOURCES.find((s) => s.key === source)?.label ?? source;
}

function sourceColor(source: string) {
  return SOURCES.find((s) => s.key === source)?.color ?? "#888";
}

function ExploreCard({ deck, onImport, importing }: { deck: ExploreDeck; onImport?: (deck: ExploreDeck) => void; importing?: boolean }) {
  const canImport = SOURCES.find((s) => s.key === deck.source)?.importable ?? false;

  return (
    <div
      className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-bg-card group transition-transform duration-150 hover:scale-[1.03] active:scale-100"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
    >
      <a
        href={deck.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0"
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
      </a>

      {/* Source + views badge */}
      <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5 pointer-events-none">
        <span
          className="px-1.5 py-0.5 rounded-md text-[9px] text-white font-medium uppercase tracking-wider"
          style={{ background: sourceColor(deck.source) + "CC" }}
        >
          {sourceLabel(deck.source)}
        </span>
        {deck.viewCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white/50 font-medium flex items-center gap-0.5">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            {deck.source === "edhrec" ? `${formatViews(deck.viewCount)} decks` : deck.source === "mtgtop8" ? `${deck.viewCount}% meta` : formatViews(deck.viewCount)}
          </span>
        )}
      </div>

      {/* Import button */}
      {canImport && onImport && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onImport(deck); }}
          disabled={importing}
          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-white hover:bg-accent transition-colors active:scale-90 disabled:opacity-50"
          title="Import to My Decks"
        >
          {importing ? (
            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
            </svg>
          )}
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2 pointer-events-none">
        <div className="min-w-0">
          <p className="font-display text-white font-bold text-xs uppercase tracking-wide truncate leading-tight">
            {deck.name}
          </p>
          <p className="text-[10px] text-white/50 truncate mt-0.5">
            {deck.owner}
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
    </div>
  );
}

function extractDeckId(deck: ExploreDeck): string | null {
  if (deck.source === "archidekt") {
    const match = deck.id.match(/archidekt-(\d+)/);
    return match?.[1] ?? null;
  }
  if (deck.source === "moxfield") {
    const match = deck.id.match(/moxfield-(.+)/);
    return match?.[1] ?? null;
  }
  return null;
}

export default function ExploreDecks() {
  const router = useRouter();
  const [source, setSource] = useState("archidekt");
  const [format, setFormat] = useState("commander");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [decks, setDecks] = useState<ExploreDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDecks = useCallback(async (p: number, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format, page: String(p), source });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/explore-decks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ExploreResult = await res.json();
      setDecks((prev) => append ? [...prev, ...data.decks] : data.decks);
      setHasMore(data.hasMore);
      setPage(data.page);
    } catch {
      setError("Couldn't load decks. Try again later.");
      if (!append) setDecks([]);
    } finally {
      setLoading(false);
    }
  }, [format, debouncedSearch, source]);

  useEffect(() => {
    fetchDecks(1);
  }, [fetchDecks]);

  const handleImport = useCallback(async (deck: ExploreDeck) => {
    const externalId = extractDeckId(deck);
    if (!externalId) return;

    setImportingId(deck.id);
    setImportStatus(null);

    try {
      const res = await fetch("/api/import-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: deck.source, deckId: externalId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setImportStatus({ type: "error", message: data.error ?? "Import failed" });
        return;
      }

      setImportStatus({
        type: "success",
        message: `Imported "${data.name}" — ${data.importedCards} cards${data.skippedCards > 0 ? ` (${data.skippedCards} skipped)` : ""}`,
      });

      setTimeout(() => {
        router.push(`/decks/${data.deckId}`);
      }, 1500);
    } catch {
      setImportStatus({ type: "error", message: "Network error. Try again." });
    } finally {
      setImportingId(null);
    }
  }, [router]);

  const isEdhrec = source === "edhrec";

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="glass-card border border-border rounded-2xl p-1 flex gap-1">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            onClick={() => { setSource(s.key); setPage(1); setDecks([]); }}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center",
              source === s.key
                ? "text-white shadow-md"
                : "text-text-muted hover:text-text-primary"
            )}
            style={source === s.key ? { background: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Format chips — hidden for EDHREC (commander only) */}
      {!isEdhrec && (
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
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder={isEdhrec ? "Search commanders..." : "Search decks..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-primary border border-border text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 transition-colors"
        />
      </div>

      {/* Import status toast */}
      {importStatus && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2",
            importStatus.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          )}
        >
          {importStatus.type === "success" ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          {importStatus.message}
          <button onClick={() => setImportStatus(null)} className="ml-auto text-white/40 hover:text-white/70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
              <ExploreCard key={deck.id} deck={deck} onImport={handleImport} importing={importingId === deck.id} />
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
