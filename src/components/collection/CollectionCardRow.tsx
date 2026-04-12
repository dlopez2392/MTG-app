"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { CollectionCard } from "@/types/collection";
import { CONDITIONS } from "@/lib/constants";

interface CollectionCardRowProps {
  card: CollectionCard;
  onQuantityChange: (id: string, newQty: number) => void;
  onRemove: (id: string) => void;
  onCardClick?: () => void;
}

function rarityBorder(rarity?: string): string {
  switch (rarity) {
    case "mythic":   return "border-l-accent";
    case "rare":     return "border-l-mtg-gold";
    case "uncommon": return "border-l-[#94A3B8]";
    default:         return "border-l-border";
  }
}

function rarityDot(rarity?: string): string {
  switch (rarity) {
    case "mythic":   return "bg-accent";
    case "rare":     return "bg-mtg-gold";
    case "uncommon": return "bg-[#94A3B8]";
    default:         return "bg-text-muted";
  }
}

export default function CollectionCardRow({
  card,
  onQuantityChange,
  onRemove,
  onCardClick,
}: CollectionCardRowProps) {
  const conditionLabel =
    CONDITIONS.find((c) => c.value === card.condition)?.label ?? card.condition;

  const price = parseFloat(card.priceUsd ?? "0");
  const totalPrice = price * card.quantity;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 py-3 px-3 bg-bg-card rounded-lg",
        "border border-border border-l-2",
        rarityBorder(card.rarity),
        "hover:bg-bg-hover/40 hover:border-border/70 transition-all duration-150"
      )}
    >
      {/* Card image + details — clickable area */}
      <button
        onClick={onCardClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-90 active:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset focus-visible:rounded-md"
        disabled={!onCardClick}
      >
        {/* Card image */}
        <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-bg-hover relative">
          {card.imageUri ? (
            <Image
              src={card.imageUri}
              alt={card.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5" />
              </svg>
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-primary truncate leading-snug">
              {card.name}
            </span>
            {card.isFoil && (
              <span className="text-[10px] font-bold text-accent bg-accent/15 px-1.5 py-0.5 rounded-full leading-none">
                FOIL
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {card.setCode && (
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {card.setCode}
              </span>
            )}
            {/* Rarity dot */}
            {card.rarity && (
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", rarityDot(card.rarity))} />
            )}
            <span className="text-[10px] text-text-muted capitalize">{conditionLabel}</span>
          </div>
          <div className="text-xs font-semibold text-accent mt-0.5">
            ${totalPrice.toFixed(2)}
            {card.quantity > 1 && (
              <span className="text-text-muted font-normal ml-1">(${price.toFixed(2)} ea)</span>
            )}
          </div>
        </div>
      </button>

      {/* Quantity controls */}
      <div className="flex items-center gap-1 flex-shrink-0 border-l border-border pl-2">
        <button
          onClick={() => {
            if (card.quantity <= 1) onRemove(card.id!);
            else onQuantityChange(card.id!, card.quantity - 1);
          }}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-card",
            card.quantity <= 1
              ? "bg-banned/20 text-banned hover:bg-banned/30"
              : "bg-bg-hover text-text-primary hover:bg-bg-secondary"
          )}
        >
          {card.quantity <= 1 ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ) : "−"}
        </button>
        <span className="w-7 text-center text-sm font-semibold text-text-primary tabular-nums">
          {card.quantity}
        </span>
        <button
          onClick={() => onQuantityChange(card.id!, card.quantity + 1)}
          className="w-7 h-7 rounded-md bg-bg-hover flex items-center justify-center text-sm font-bold text-text-primary hover:bg-bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-card"
        >
          +
        </button>
      </div>

      {/* Remove — fades in on hover */}
      <button
        onClick={() => onRemove(card.id!)}
        className="p-1 text-text-muted hover:text-banned transition-colors flex-shrink-0 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banned/60"
        title="Remove card"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
