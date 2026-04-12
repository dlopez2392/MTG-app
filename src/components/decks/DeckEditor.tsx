"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDeckCards, useDecks } from "@/hooks/useDecks";
import { useToast } from "@/hooks/useToast";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";
import DeckCardRow from "./DeckCardRow";
import DeckCardGrid from "./DeckCardGrid";
import DeckImportExport from "./DeckImportExport";
import type { DeckCard, DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

const CATEGORY_TABS = [
  { value: "main",       label: "Main"      },
  { value: "sideboard",  label: "Sideboard" },
  { value: "commander",  label: "Commander" },
  { value: "maybeboard", label: "Maybe"     },
];

type ViewMode = "list" | "grid";

interface DeckEditorProps {
  deckId: string;
}

export default function DeckEditor({ deckId }: DeckEditorProps) {
  const router = useRouter();
  const { cards, updateCardQuantity, removeCardFromDeck, refresh } = useDeckCards(deckId);
  const { addCardToDeck } = useDecks();
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab]         = useState<string>("main");
  const [viewMode, setViewMode]           = useState<ViewMode>("list");
  const [showImportExport, setShowImportExport] = useState(false);

  const filteredCards = cards?.filter((c) => c.category === activeTab) ?? [];
  const totalCards    = cards?.filter((c) => c.category !== "maybeboard").reduce((sum, c) => sum + c.quantity, 0) ?? 0;

  const handleQuantityChange = useCallback((id: string, qty: number) => {
    updateCardQuantity(id, qty);
    const card = cards?.find((c) => c.id === id);
    if (card) showToast(`${card.name} · ${qty}×`);
  }, [updateCardQuantity, cards, showToast]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-stat text-text-secondary">{totalCards} cards</p>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-bg-card border border-border rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                viewMode === "list" ? "bg-accent text-black" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                viewMode === "grid" ? "bg-accent text-black" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => setShowImportExport(true)}
            className="text-sm text-accent hover:text-accent-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            Import/Export
          </button>

          <button
            onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-black hover:bg-accent-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Cards
          </button>
        </div>
      </div>

      <Tabs tabs={CATEGORY_TABS} active={activeTab} onChange={setActiveTab} />

      {/* Card list / grid */}
      {filteredCards.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-body text-text-muted">
            No cards in {activeTab === "main" ? "mainboard" : activeTab === "maybeboard" ? "maybeboard" : activeTab}
          </p>
          <button
            onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
            className="mt-2 text-sm text-accent hover:text-accent-dark transition-colors"
          >
            Search for cards to add
          </button>
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-2">
          {filteredCards.map((card) => (
            <DeckCardRow
              key={card.id}
              card={card}
              onQuantityChange={handleQuantityChange}
              onRemove={removeCardFromDeck}
              onCardClick={() => router.push(`/search/${card.scryfallId}?deckId=${deckId}&category=${activeTab}`)}
            />
          ))}
        </div>
      ) : (
        <DeckCardGrid
          cards={filteredCards}
          onQuantityChange={handleQuantityChange}
          onRemove={removeCardFromDeck}
          onCardClick={(card) => router.push(`/search/${card.scryfallId}?deckId=${deckId}&category=${activeTab}`)}
        />
      )}

      <DeckImportExport
        open={showImportExport}
        onClose={() => { setShowImportExport(false); refresh(); }}
        deckId={deckId}
        cards={cards ?? []}
        onImportCards={async (card: Partial<ScryfallCard>, category: DeckCard["category"], quantity: number) => {
          await addCardToDeck(deckId, card, category, quantity);
        }}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
