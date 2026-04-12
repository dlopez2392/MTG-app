"use client";

import { useState, use, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import CardImage from "@/components/cards/CardImage";
import ManaCost from "@/components/cards/ManaCost";
import LegalityTable from "@/components/cards/LegalityTable";
import PriceTable from "@/components/cards/PriceTable";
import RulingsPanel from "@/components/cards/RulingsPanel";
import Tabs from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import { useCardDetail } from "@/hooks/useCardDetail";
import { useDecks } from "@/hooks/useDecks";
import { useCollection } from "@/hooks/useCollection";
import { useCardCombos } from "@/hooks/useCardCombos";
import CombosPanel from "@/components/cards/CombosPanel";
import CardPricesPanel from "@/components/cards/CardPricesPanel";
import type { DeckCategory } from "@/types/deck";

export default function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { card, rulings, printings, loading, error } = useCardDetail(id);
  const { addCardToDeck } = useDecks();
  const { addCardToBinder } = useCollection();
  const [activeTab, setActiveTab] = useState("versions");
  const comboState = useCardCombos(card?.name ?? "");

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === "combos") comboState.load();
  }, [comboState]);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [addedCollectionFeedback, setAddedCollectionFeedback] = useState(false);

  const deckId = searchParams.get("deckId");
  const category = (searchParams.get("category") ?? "main") as DeckCategory;
  const binderId = searchParams.get("binderId");

  const handleAddToDeck = useCallback(async () => {
    if (!card || !deckId) return;
    await addCardToDeck(deckId, card, category);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  }, [card, deckId, category, addCardToDeck]);

  const handleAddToCollection = useCallback(async () => {
    if (!card || !binderId) return;
    const imageUri = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
    try {
      await addCardToBinder(binderId, {
        scryfallId: card.id,
        name: card.name,
        setCode: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        typeLine: card.type_line,
        rarity: card.rarity,
        imageUri,
        priceUsd: card.prices?.usd,
      });
      setAddedCollectionFeedback(true);
      setTimeout(() => setAddedCollectionFeedback(false), 1500);
    } catch (err) {
      alert(`Failed to add card: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [card, binderId, addCardToBinder]);

  if (loading) {
    return (
      <>
        <TopBar title="Loading..." showBack />
        <PageContainer>
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="w-full sm:w-64 aspect-[488/680]" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </PageContainer>
      </>
    );
  }

  if (error || !card) {
    return (
      <>
        <TopBar title="Error" showBack />
        <PageContainer>
          <p className="text-banned">{error || "Card not found"}</p>
        </PageContainer>
      </>
    );
  }

  const oracleText = card.oracle_text || card.card_faces?.[0]?.oracle_text || "";
  const typeLine = card.type_line;
  const manaCost = card.mana_cost || card.card_faces?.[0]?.mana_cost || "";

  return (
    <>
      <TopBar title={card.name} showBack />
      <PageContainer>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Card Image */}
          <div className="flex-shrink-0 sm:w-64">
            <CardImage card={card} size="normal" />
          </div>

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-xl font-bold">{card.name}</h1>
              {manaCost && <ManaCost cost={manaCost} />}
            </div>

            <p className="text-text-secondary text-sm mb-1">{typeLine}</p>

            {(card.power || card.card_faces?.[0]?.power) && (
              <p className="text-sm text-text-secondary mb-2">
                {card.power || card.card_faces?.[0]?.power}/{card.toughness || card.card_faces?.[0]?.toughness}
              </p>
            )}

            {card.loyalty && (
              <p className="text-sm text-text-secondary mb-2">Loyalty: {card.loyalty}</p>
            )}

            <div className="mb-4">
              <p className="text-sm whitespace-pre-wrap">{oracleText}</p>
            </div>

            {/* Prices */}
            <div className="mb-4">
              <CardPricesPanel card={card} />
            </div>

            {/* Set Info */}
            <p className="text-xs text-text-muted mb-4">
              {card.set_name} ({card.set.toUpperCase()}) &middot; #{card.collector_number} &middot;{" "}
              <span className="capitalize">{card.rarity}</span>
            </p>

            {/* Add to Deck button */}
            {deckId && (
              <button
                onClick={handleAddToDeck}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all bg-accent text-black hover:bg-accent-dark active:scale-95 shadow-[0_2px_12px_rgba(237,154,87,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
              >
                {addedFeedback ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Added!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add to Deck ({category})
                  </>
                )}
              </button>
            )}

            {/* Add to Collection button */}
            {binderId && (
              <button
                onClick={handleAddToCollection}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all bg-bg-card border border-accent/50 text-accent hover:bg-accent/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
              >
                {addedCollectionFeedback ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Added to Collection!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add to Collection
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <Tabs
            tabs={[
              { value: "versions", label: "Printings" },
              { value: "rulings", label: "Rulings" },
              { value: "combos", label: `Combos${comboState.loaded && comboState.count > 0 ? ` (${comboState.count})` : ""}` },
            ]}
            active={activeTab}
            onChange={handleTabChange}
            className="mb-4"
          />

          {activeTab === "versions" && (
            <PriceTable printings={printings} deckId={deckId} category={category} />
          )}

          {activeTab === "rulings" && (
            <div className="space-y-6">
              <LegalityTable legalities={card.legalities} />
              {rulings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">Rulings</h3>
                  <RulingsPanel rulings={rulings} />
                </div>
              )}
            </div>
          )}

          {activeTab === "combos" && (
            <CombosPanel
              cardName={card.name}
              combos={comboState.combos}
              count={comboState.count}
              loading={comboState.loading}
              error={comboState.error}
              loaded={comboState.loaded}
            />
          )}
        </div>
      </PageContainer>
    </>
  );
}
