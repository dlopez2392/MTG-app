"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import HeroBanner from "@/components/layout/HeroBanner";
import { loadSettings } from "@/hooks/useSettings";
import SearchBar from "@/components/search/SearchBar";
import SearchFilters from "@/components/search/SearchFilters";
import ViewToggle from "@/components/search/ViewToggle";
import CardGrid from "@/components/cards/CardGrid";
import CardList from "@/components/cards/CardList";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useCardSearch } from "@/hooks/useCardSearch";
import { type SearchFilters as SearchFiltersType, DEFAULT_FILTERS } from "@/types/card";

export default function SearchPage() {
  const router = useRouter();
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
        title="Search Cards"
        subtitle="Browse the full Scryfall database"
        accent="#ED9A57"
        icon={SEARCH_ICON}
      >
        <SearchBar
          value={filters.query}
          onChange={(query) => setFilters((f) => ({ ...f, query }))}
          onSubmit={handleSearch}
          onSelect={handleSelect}
        />
      </HeroBanner>

    <PageContainer>
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
    </PageContainer>
    </>
  );
}
