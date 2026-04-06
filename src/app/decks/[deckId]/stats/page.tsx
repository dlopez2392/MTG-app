"use client";

import { use, useEffect, useState } from "react";
import { useDecks } from "@/hooks/useDecks";
import { calculateDeckStats } from "@/lib/utils/deckStats";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import ManaCurveChart from "@/components/decks/stats/ManaCurveChart";
import ColorPieChart from "@/components/decks/stats/ColorPieChart";
import TypeBreakdown from "@/components/decks/stats/TypeBreakdown";
import type { Deck, DeckStats } from "@/types/deck";

export default function DeckStatsPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId: deckIdStr } = use(params);
  const deckId = Number(deckIdStr);
  const { getDeck, useDeckCards } = useDecks();
  const cards = useDeckCards(deckId);
  const [deck, setDeck] = useState<Deck | undefined>();

  useEffect(() => {
    getDeck(deckId).then(setDeck);
  }, [deckId]);

  const stats: DeckStats | null = cards ? calculateDeckStats(cards) : null;

  if (!stats) {
    return (
      <>
        <TopBar title="Deck Stats" showBack />
        <PageContainer>
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <TopBar title={deck ? `${deck.name} - Stats` : "Deck Stats"} showBack />
      <PageContainer>
        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.totalCards}</p>
              <p className="text-xs text-text-muted mt-1">Total Cards</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">
                {stats.averageCmc.toFixed(2)}
              </p>
              <p className="text-xs text-text-muted mt-1">Avg CMC</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">
                ${stats.totalValue.toFixed(2)}
              </p>
              <p className="text-xs text-text-muted mt-1">Total Value</p>
            </div>
          </div>

          {/* Mana Curve */}
          <section className="bg-bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Mana Curve</h2>
            <ManaCurveChart manaCurve={stats.manaCurve} />
          </section>

          {/* Color Distribution */}
          <section className="bg-bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Color Distribution</h2>
            <ColorPieChart colorDistribution={stats.colorDistribution} />
          </section>

          {/* Type Breakdown */}
          <section className="bg-bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Type Breakdown</h2>
            <TypeBreakdown typeBreakdown={stats.typeBreakdown} />
          </section>
        </div>
      </PageContainer>
    </>
  );
}
