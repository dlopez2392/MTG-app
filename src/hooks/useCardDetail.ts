"use client";

import { useState, useEffect } from "react";
import type { ScryfallCard, ScryfallRuling } from "@/types/card";

export function useCardDetail(id: string) {
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [rulings, setRulings] = useState<ScryfallRuling[]>([]);
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const cardRes = await fetch(`/api/scryfall/cards/${id}`);
        const data = await cardRes.json();
        if (cancelled) return;
        if (data.error) { setError(data.error); setLoading(false); return; }
        setCard(data);
        setLoading(false);

        const [rulingsRes, printingsRes] = await Promise.all([
          fetch(`/api/scryfall/rulings/${id}`).then((r) => r.json()),
          data.oracle_id
            ? fetch(`/api/scryfall/search?q=${encodeURIComponent(`oracleid:${data.oracle_id}`)}&unique=prints&order=released`).then((r) => r.json())
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        setRulings(rulingsRes.data || []);
        setPrintings(printingsRes.data || []);
      } catch {
        if (!cancelled) { setError("Failed to load card"); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  return { card, rulings, printings, loading, error };
}
