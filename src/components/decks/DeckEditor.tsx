"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDeckCards, useDecks } from "@/hooks/useDecks";
import { useToast } from "@/hooks/useToast";
import { useCollectionMap } from "@/hooks/useCollectionMap";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";
import DeckCardRow from "./DeckCardRow";
import DeckCardGrid from "./DeckCardGrid";
import DeckImportExport from "./DeckImportExport";
import HandSimulator from "./HandSimulator";
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
  const collectionMap = useCollectionMap();

  const [activeTab, setActiveTab]         = useState<string>("main");
  const [viewMode, setViewMode]           = useState<ViewMode>("list");
  const [showImportExport, setShowImportExport] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

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

          {/* Packages */}
          <button
            onClick={() => router.push(`/packages?deckId=${deckId}`)}
            title="Add card packages"
            className="p-1.5 text-text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
            </svg>
          </button>

          <button
            onClick={() => setShowSimulator(true)}
            title="Open hand simulator"
            className="p-1.5 text-text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            {/* Play / cards icon */}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
          </button>

          <button
            onClick={() => setShowImportExport(true)}
            className="text-sm text-accent hover:text-accent-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            Import/Export
          </button>

          <button
            onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-xl bg-accent text-black hover:bg-accent-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
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
              ownedQty={collectionMap.get(card.scryfallId)}
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

      <HandSimulator
        open={showSimulator}
        onClose={() => setShowSimulator(false)}
        cards={cards ?? []}
      />
    </div>
  );
}
