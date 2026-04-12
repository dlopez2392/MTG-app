"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeckCards, useDecks } from "@/hooks/useDecks";
import Tabs from "@/components/ui/Tabs";
import DeckCardRow from "./DeckCardRow";
import DeckImportExport from "./DeckImportExport";
import type { DeckCard, DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

const CATEGORY_TABS = [
  { value: "main", label: "Main" },
  { value: "sideboard", label: "Sideboard" },
  { value: "commander", label: "Commander" },
  { value: "maybeboard", label: "Maybe" },
];

interface DeckEditorProps {
  deckId: string;
}

export default function DeckEditor({ deckId }: DeckEditorProps) {
  const router = useRouter();
  const { cards, updateCardQuantity, removeCardFromDeck, refresh } = useDeckCards(deckId);
  const { addCardToDeck } = useDecks();
  const [activeTab, setActiveTab] = useState<string>("main");
  const [showImportExport, setShowImportExport] = useState(false);

  const filteredCards = cards?.filter((c) => c.category === activeTab) ?? [];
  // Maybeboard cards don't count toward the deck total
  const totalCards = cards?.filter((c) => c.category !== "maybeboard").reduce((sum, c) => sum + c.quantity, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-stat text-text-secondary">{totalCards} cards</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportExport(true)}
            className="text-sm text-accent hover:text-accent-dark transition-colors"
          >
            Import/Export
          </button>
          <button
            onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-black hover:bg-accent-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Cards
          </button>
        </div>
      </div>

      <Tabs tabs={CATEGORY_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="flex flex-col gap-2">
        {filteredCards.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">
              No cards in {activeTab === "main" ? "mainboard" : activeTab === "maybeboard" ? "maybeboard" : activeTab}
            </p>
            <button
              onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
              className="mt-2 text-sm text-accent hover:text-accent-dark transition-colors"
            >
              Search for cards to add
            </button>
          </div>
        ) : (
          filteredCards.map((card) => (
            <DeckCardRow
              key={card.id}
              card={card}
              onQuantityChange={updateCardQuantity}
              onRemove={removeCardFromDeck}
              onCardClick={() => router.push(`/search/${card.scryfallId}?deckId=${deckId}&category=${activeTab}`)}
            />
          ))
        )}
      </div>

      <DeckImportExport
        open={showImportExport}
        onClose={() => { setShowImportExport(false); refresh(); }}
        deckId={deckId}
        cards={cards ?? []}
        onImportCards={async (card: Partial<ScryfallCard>, category: DeckCard["category"], quantity: number) => {
          await addCardToDeck(deckId, card, category, quantity);
        }}
      />
    </div>
  );
}
