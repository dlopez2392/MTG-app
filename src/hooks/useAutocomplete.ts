"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";

export interface CardSuggestion {
  id: string;
  name: string;
  imageUri: string | null;
  manaCost: string | null;
  typeLine: string | null;
}

export function useAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/scryfall/suggest?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data: CardSuggestion[]) => {
        if (!cancelled) setSuggestions(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  return { suggestions, loading };
}
