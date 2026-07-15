"use client";

import { useEffect, useState, useCallback } from "react";
import type { DeckPrimerData } from "@/types/deck";

interface Props {
  deckId: string;
}

export default function DeckPrimer({ deckId }: Props) {
  const [primer, setPrimer] = useState<DeckPrimerData | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [deckUpdatedAt, setDeckUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${deckId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((deck) => {
        if (cancelled || !deck) return;
        setPrimer(deck.primer ?? null);
        setGeneratedAt(deck.primerGeneratedAt ?? null);
        setDeckUpdatedAt(deck.updatedAt ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deck-primer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate primer.");
        return;
      }
      setPrimer(data.primer ?? null);
      setGeneratedAt(data.primerGeneratedAt ?? new Date().toISOString());
    } catch {
      setError("Failed to generate primer.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  const stale =
    !!primer && !!generatedAt && !!deckUpdatedAt && new Date(deckUpdatedAt) > new Date(generatedAt);

  return (
    <div className="glass-card border border-border rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-section-label text-text-muted">AI Deck Primer</p>
        {primer && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
          >
            {loading ? "Generating…" : "Regenerate"}
          </button>
        )}
      </div>

      {!primer && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-text-secondary">
            Generate a shareable primer — game plan, key cards, mulligan guide, and key lines.
            It appears here and on your deck&apos;s public share page.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-gradient rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate primer"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-banned mt-2">{error}</p>}

      {primer && (
        <div className="space-y-3">
          {stale && (
            <p className="text-xs text-text-muted italic">
              Deck changed since this primer — regenerate to refresh it.
            </p>
          )}
          {primer.tagline && (
            <p className="text-base font-semibold text-text-primary">{primer.tagline}</p>
          )}

          {primer.gamePlan && (
            <div>
              <p className="text-label text-accent mb-1">Game plan</p>
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{primer.gamePlan}</p>
            </div>
          )}

          {primer.keyCards?.length > 0 && (
            <div>
              <p className="text-label text-accent mb-1">Key cards</p>
              <ul className="space-y-1">
                {primer.keyCards.map((c, i) => (
                  <li key={i} className="text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{c.name}</span>
                    {c.note ? ` — ${c.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {primer.mulligan && (
            <div>
              <p className="text-label text-accent mb-1">Mulligan guide</p>
              <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{primer.mulligan}</p>
            </div>
          )}

          {primer.keyLines?.length > 0 && (
            <div>
              <p className="text-label text-accent mb-1">Key lines</p>
              <ul className="list-disc list-inside space-y-1">
                {primer.keyLines.map((line, i) => (
                  <li key={i} className="text-sm text-text-secondary leading-relaxed">{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
