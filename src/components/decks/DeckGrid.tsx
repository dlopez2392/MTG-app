"use client";

import type { Deck } from "@/types/deck";
import DeckCard from "./DeckCard";

interface DeckGridProps {
  decks: Deck[];
  onDeckClick: (deck: Deck) => void;
  onDeckDelete: (deck: Deck) => void;
}

export default function DeckGrid({ decks, onDeckClick, onDeckDelete }: DeckGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {decks.map((deck) => (
        <DeckCard
          key={deck.id}
          deck={deck}
          onClick={() => onDeckClick(deck)}
          onDelete={(e) => { e.stopPropagation(); onDeckDelete(deck); }}
        />
      ))}
    </div>
  );
}
