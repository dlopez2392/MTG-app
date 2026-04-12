"use client";

import { useState, useCallback } from "react";
import type { EnrichedCombo } from "@/types/combo";

interface UseCardCombosReturn {
  combos: EnrichedCombo[];
  count: number;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  load: () => void;
}

export function useCardCombos(cardName: string): UseCardCombosReturn {
  const [combos, setCombos] = useState<EnrichedCombo[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/combos?name=${encodeURIComponent(cardName)}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setCombos(data.combos ?? []);
      setCount(data.count ?? 0);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load combos");
    } finally {
      setLoading(false);
    }
  }, [cardName, loaded, loading]);

  return { combos, count, loading, error, loaded, load };
}
