"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import HeroBanner from "@/components/layout/HeroBanner";
import { loadSettings } from "@/hooks/useSettings";
import SearchBar from "@/components/search/SearchBar";
import SearchFilters from "@/components/search/SearchFilters";
import ViewToggle from "@/components/search/ViewToggle";
import SetsTab from "@/components/search/SetsTab";
import CardGrid from "@/components/cards/CardGrid";
import CardList from "@/components/cards/CardList";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useCardSearch } from "@/hooks/useCardSearch";
import { type SearchFilters as SearchFiltersType, DEFAULT_FILTERS } from "@/types/card";
import { cn } from "@/lib/utils/cn";

type Tab = "cards" | "sets";

export default function SearchPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("cards");
  const [filters, setFilters] = useState<SearchFiltersType>(DEFAULT_FILTERS);
  const [view, setView] = useState<"grid" | "list">(() => loadSettings().defaultSearchView);
  const [initialized, setInitialized] = useState(false);
  const { cards, loading, error, hasMore, totalCards, search, loadMore } = useCardSearch();

  const [deckContext, setDeckContext] = useState<{ deckId: string; category: string } | null>(null);
  const [binderContext, setBinderContext] = useState<string | null>(null);

  // Read ?q=, ?deckId=, ?category=, ?binderId= params on mount and auto-search
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const deckId = params.get("deckId");
    const category = params.get("category");
    const binderId = params.get("binderId");
    if (deckId) setDeckContext({ deckId, category: category ?? "main" });
    if (binderId) setBinderContext(binderId);
    if (q) {
      const updated = { ...DEFAULT_FILTERS, query: q };
      setFilters(updated);
      search(updated);
    }
  }, [initialized, search]);

  const handleSearch = useCallback(() => {
    search(filters);
  }, [filters, search]);

  const handleSelect = useCallback(
    (name: string) => {
      const updated = { ...filters, query: name };
      setFilters(updated);
      search(updated);
    },
    [filters, search]
  );

  const handleCardClick = useCallback(
    (card: { id: string }) => {
      const params = new URLSearchParams();
      if (deckContext) {
        params.set("deckId", deckContext.deckId);
        params.set("category", deckContext.category);
      }
      if (binderContext) params.set("binderId", binderContext);
      const qs = params.toString();
      router.push(`/search/${card.id}${qs ? `?${qs}` : ""}`);
    },
    [router, deckContext, binderContext]
  );

  const SEARCH_ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Search"
        subtitle="Browse the full Scryfall database"
        accent="#ED9A57"
        icon={SEARCH_ICON}
      >
        {tab === "cards" && (
          <SearchBar
            value={filters.query}
            onChange={(query) => setFilters((f) => ({ ...f, query }))}
            onSubmit={handleSearch}
            onSelect={handleSelect}
          />
        )}
      </HeroBanner>

      {/* ── Tab switcher ── */}
      <div className="flex border-b border-border bg-bg-primary sticky top-0 z-10">
        {(["cards", "sets"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 pt-3 pb-2 text-xs font-bold uppercase tracking-widest transition-colors",
              tab === t ? "text-accent" : "text-text-muted hover:text-text-secondary"
            )}
          >
            {t === "cards" ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            )}
            {t}
            {/* Active indicator bar */}
            <div className={cn(
              "h-0.5 rounded-full transition-all duration-200",
              tab === t ? "w-8 bg-accent" : "w-0 bg-transparent"
            )} />
          </button>
        ))}
      </div>

      <PageContainer>
        {tab === "sets" ? (
          <SetsTab />
        ) : (
          <>
            <SearchFilters filters={filters} onChange={setFilters} className="mb-4" />

            <div className="flex items-center justify-between mb-3">
              {totalCards > 0 && (
                <span className="text-sm text-text-muted">
                  {totalCards.toLocaleString()} cards found
                </span>
              )}
              <ViewToggle view={view} onChange={setView} />
            </div>

            {error && (
              <div className="bg-banned/10 border border-banned/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-banned">{error}</p>
              </div>
            )}

            {loading && cards.length === 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[488/680] w-full" />
                ))}
              </div>
            )}

            {!loading && cards.length === 0 && !error && (
              <EmptyState
                icon={
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                title="Search for cards"
                description="Enter a card name or use filters to find Magic: The Gathering cards"
              />
            )}

            {cards.length > 0 && (
              <>
                {view === "grid" ? (
                  <CardGrid cards={cards} onCardClick={handleCardClick} />
                ) : (
                  <CardList cards={cards} onCardClick={handleCardClick} />
                )}

                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <Button
                      variant="secondary"
                      onClick={() => loadMore(filters)}
                      disabled={loading}
                    >
                      {loading ? "Loading…" : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </PageContainer>
    </>
  );
}
