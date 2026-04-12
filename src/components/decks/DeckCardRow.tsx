"use client";

import type { DeckCard } from "@/types/deck";
import ManaCost from "@/components/cards/ManaCost";
import { formatPrice } from "@/lib/utils/prices";

interface DeckCardRowProps {
  card: DeckCard;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCardClick?: () => void;
}

export default function DeckCardRow({ card, onQuantityChange, onRemove, onCardClick }: DeckCardRowProps) {
  const cardId = card.id!;

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-bg-card rounded-lg border border-border">
      <button
        onClick={onCardClick}
        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 active:opacity-60 transition-opacity"
        disabled={!onCardClick}
      >
        {card.imageUri && (
          <img
            src={card.imageUri}
            alt={card.name}
            className="w-8 h-11 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{card.name}</p>
          <div className="flex items-center gap-2">
            {card.manaCost && <ManaCost cost={card.manaCost} className="scale-75 origin-left" />}
            <span className="text-xs text-text-muted">{formatPrice(card.priceUsd)}</span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onQuantityChange(cardId, card.quantity - 1)}
          className="w-7 h-7 flex items-center justify-center rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors text-sm font-bold"
        >
          -
        </button>
        <span className="w-6 text-center text-sm font-medium text-text-primary">
          {card.quantity}
        </span>
        <button
          onClick={() => onQuantityChange(cardId, card.quantity + 1)}
          className="w-7 h-7 flex items-center justify-center rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors text-sm font-bold"
        >
          +
        </button>
      </div>

      <button
        onClick={() => onRemove(cardId)}
        className="p-1 text-text-muted hover:text-banned transition-colors flex-shrink-0"
        title="Remove card"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
