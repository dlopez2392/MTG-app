"use client";

import { useState, useCallback } from "react";
import type { ScryfallCard, SearchFilters } from "@/types/card";
import { buildScryfallQuery } from "@/lib/utils/mana";

interface SearchState {
  cards: ScryfallCard[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCards: number;
  page: number;
}

export function useCardSearch() {
  const [state, setState] = useState<SearchState>({
    cards: [],
    loading: false,
    error: null,
    hasMore: false,
    totalCards: 0,
    page: 1,
  });

  const search = useCallback(async (filters: SearchFilters, page = 1) => {
    const query = buildScryfallQuery(filters);
    if (!query.trim()) {
      setState({ cards: [], loading: false, error: null, hasMore: false, totalCards: 0, page: 1 });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({ q: query, page: String(page) });
      const res = await fetch(`/api/scryfall/search?${params}`);
      const data = await res.json();

      if (data.error) {
        setState((prev) => ({ ...prev, loading: false, error: data.error }));
        return;
      }

      setState((prev) => ({
        cards: page === 1 ? data.data : [...prev.cards, ...data.data],
        loading: false,
        error: null,
        hasMore: data.has_more || false,
        totalCards: data.total_cards || data.data.length,
        page,
      }));
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: "Failed to search cards" }));
    }
  }, []);

  const loadMore = useCallback(
    (filters: SearchFilters) => {
      if (state.hasMore && !state.loading) {
        search(filters, state.page + 1);
      }
    },
    [state.hasMore, state.loading, state.page, search]
  );

  const reset = useCallback(() => {
    setState({ cards: [], loading: false, error: null, hasMore: false, totalCards: 0, page: 1 });
  }, []);

  return { ...state, search, loadMore, reset };
}
