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

    fetch(`/api/scryfall/cards/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setCard(data);

        // Fetch rulings
        fetch(`/api/scryfall/rulings/${id}`)
          .then((res) => res.json())
          .then((r) => { if (!cancelled) setRulings(r.data || []); });

        // Fetch printings
        if (data.oracle_id) {
          fetch(`/api/scryfall/search?q=${encodeURIComponent(`oracleid:${data.oracle_id}`)}&unique=prints&order=released`)
            .then((res) => res.json())
            .then((p) => { if (!cancelled) setPrintings(p.data || []); });
        }

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load card");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id]);

  return { card, rulings, printings, loading, error };
}
