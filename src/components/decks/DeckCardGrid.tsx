"use client";

import { cn } from "@/lib/utils/cn";
import type { DeckCard } from "@/types/deck";

interface DeckCardGridProps {
  cards: DeckCard[];
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCardClick?: (card: DeckCard) => void;
}

function rarityBorder(rarity?: string): string {
  switch (rarity) {
    case "mythic":   return "border-accent";
    case "rare":     return "border-mtg-gold";
    case "uncommon": return "border-[#94A3B8]";
    default:         return "border-border";
  }
}

function GridItem({
  card,
  onQuantityChange,
  onRemove,
  onCardClick,
}: {
  card: DeckCard;
  onQuantityChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCardClick?: (card: DeckCard) => void;
}) {
  const cardId = card.id!;

  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden bg-bg-card border-2 transition-all duration-150",
        "hover:scale-[1.03] hover:shadow-lg hover:z-10",
        rarityBorder(card.rarity)
      )}
      style={{ aspectRatio: "488 / 680" }}
    >
      {/* Card image */}
      {card.imageUri ? (
        <img
          src={card.imageUri}
          alt={card.name}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => onCardClick?.(card)}
        />
      ) : (
        <button
          onClick={() => onCardClick?.(card)}
          className="w-full h-full flex items-center justify-center bg-bg-hover p-2"
        >
          <span className="text-[10px] text-text-muted text-center leading-tight">{card.name}</span>
        </button>
      )}

      {/* Quantity badge — top left */}
      <div className="absolute top-1.5 left-1.5 bg-bg-primary/90 backdrop-blur-sm rounded px-1.5 py-0.5 text-label text-text-primary">
        {card.quantity}×
      </div>

      {/* Controls overlay — appears on hover */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-6 pb-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-[10px] text-white font-medium truncate mb-1.5">{card.name}</p>
        <div className="flex items-center justify-between gap-1">
          {/* Decrement / remove */}
          <button
            onClick={() => {
              if (card.quantity <= 1) onRemove(cardId);
              else onQuantityChange(cardId, card.quantity - 1);
            }}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors",
              card.quantity <= 1
                ? "bg-banned/80 text-white"
                : "bg-white/20 text-white hover:bg-white/30"
            )}
          >
            {card.quantity <= 1 ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : "−"}
          </button>

          <span className="text-xs font-bold text-white tabular-nums">{card.quantity}</span>

          {/* Increment */}
          <button
            onClick={() => onQuantityChange(cardId, card.quantity + 1)}
            className="w-6 h-6 rounded bg-white/20 text-white hover:bg-white/30 flex items-center justify-center text-xs font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DeckCardGrid({ cards, onQuantityChange, onRemove, onCardClick }: DeckCardGridProps) {
  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {cards.map((card) => (
        <GridItem
          key={card.id}
          card={card}
          onQuantityChange={onQuantityChange}
          onRemove={onRemove}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
