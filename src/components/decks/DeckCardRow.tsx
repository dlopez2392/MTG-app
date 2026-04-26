"use client";

import type { DeckCard } from "@/types/deck";
import ManaCost from "@/components/cards/ManaCost";
import { formatPrice } from "@/lib/utils/prices";
import { cn } from "@/lib/utils/cn";

interface DeckCardRowProps {
  card: DeckCard;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCardClick?: () => void;
  ownedQty?: number;
}

const RARITY_COLORS: Record<string, string> = {
  mythic: "text-accent",
  rare: "text-mtg-gold",
  uncommon: "text-[#94A3B8]",
};

export default function DeckCardRow({ card, onQuantityChange, onRemove, onCardClick, ownedQty }: DeckCardRowProps) {
  const cardId = card.id!;
  const rarityDot = RARITY_COLORS[card.rarity ?? ""] ?? "text-text-muted";

  return (
    <div className="group flex items-center gap-1.5 py-1 px-2 hover:bg-bg-hover/50 rounded-lg transition-colors">
      {/* Quantity */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => {
            if (card.quantity <= 1) onRemove(cardId);
            else onQuantityChange(cardId, card.quantity - 1);
          }}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors opacity-0 group-hover:opacity-100"
        >
          −
        </button>
        <span className="w-5 text-center text-xs font-bold text-text-secondary tabular-nums">
          {card.quantity}
        </span>
        <button
          onClick={() => onQuantityChange(cardId, card.quantity + 1)}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors opacity-0 group-hover:opacity-100"
        >
          +
        </button>
      </div>

      {/* Card name — clickable */}
      <button
        onClick={onCardClick}
        disabled={!onCardClick}
        className="flex-1 min-w-0 text-left flex items-center gap-1.5 focus-visible:outline-none"
      >
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", rarityDot.replace("text-", "bg-"))} />
        <span className="text-sm text-text-primary truncate leading-tight hover:text-accent transition-colors">
          {card.name}
        </span>
      </button>

      {/* Owned badge */}
      {ownedQty !== undefined && (
        <span className={cn(
          "text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 tabular-nums",
          ownedQty >= card.quantity
            ? "text-legal bg-legal/15"
            : ownedQty > 0
            ? "text-restricted bg-restricted/15"
            : "text-text-muted bg-bg-hover"
        )}>
          {ownedQty}/{card.quantity}
        </span>
      )}

      {/* Mana cost */}
      <div className="flex-shrink-0 w-20 flex justify-end">
        {card.manaCost && (
          <ManaCost cost={card.manaCost} size={13} />
        )}
      </div>

      {/* Price */}
      <span className="text-xs text-text-muted tabular-nums flex-shrink-0 w-14 text-right">
        {formatPrice(card.priceUsd)}
      </span>

      {/* Remove — hover only */}
      <button
        onClick={() => onRemove(cardId)}
        className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-banned transition-colors flex-shrink-0 rounded opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
