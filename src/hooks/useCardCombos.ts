"use client";

import { useState, useCallback } from "react";
import type { EnrichedCombo } from "@/types/combo";

export type ComboStatus = "idle" | "loading" | "error" | "done";

interface UseCardCombosReturn {
  combos: EnrichedCombo[];
  count: number;
  status: ComboStatus;
  error: string | null;
  load: () => void;
}

export function useCardCombos(cardName: string): UseCardCombosReturn {
  const [combos, setCombos] = useState<EnrichedCombo[]>([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<ComboStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status === "done" || status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/combos?name=${encodeURIComponent(cardName)}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setCombos(data.combos ?? []);
      setCount(data.count ?? 0);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load combos");
      setStatus("error");
    }
  }, [cardName, status]);

  return { combos, count, status, error, load };
}
