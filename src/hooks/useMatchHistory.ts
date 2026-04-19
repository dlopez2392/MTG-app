"use client";

import { useState, useCallback, useEffect } from "react";
import type { Match, CreateMatchPayload } from "@/types/match";

export function useMatchHistory() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("Failed to load match history");
      const data = await res.json();
      setMatches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveMatch = useCallback(async (payload: CreateMatchPayload): Promise<Match | null> => {
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save match");
      const match: Match = await res.json();
      setMatches((prev) => [match, ...prev]);
      return match;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return { matches, loading, error, fetchMatches, saveMatch };
}
