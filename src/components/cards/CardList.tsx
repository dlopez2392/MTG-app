"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/prices";
import ManaCost from "@/components/cards/ManaCost";
import type { ScryfallCard } from "@/types/card";

interface CardListProps {
  cards: ScryfallCard[];
  onCardClick?: (card: ScryfallCard) => void;
  className?: string;
}

function getSmallImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris) return card.image_uris.small;
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris.small;
  return null;
}

function getManaCost(card: ScryfallCard): string | undefined {
  if (card.mana_cost) return card.mana_cost;
  if (card.card_faces?.[0]?.mana_cost) return card.card_faces[0].mana_cost;
  return undefined;
}

function rarityBorder(rarity?: string): string {
  switch (rarity) {
    case "mythic":   return "border-l-accent";
    case "rare":     return "border-l-mtg-gold";
    case "uncommon": return "border-l-[#94A3B8]";
    default:         return "border-l-border";
  }
}

export default function CardList({ cards, onCardClick, className }: CardListProps) {
  if (cards.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {cards.map((card) => {
        const thumb = getSmallImageUrl(card);
        const manaCost = getManaCost(card);
        const price = card.prices.usd ?? card.prices.usd_foil;

        return (
          <button
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className={cn(
              "group flex w-full items-center gap-3 px-3 py-2.5 text-left rounded-lg",
              "bg-bg-card border border-border border-l-2",
              rarityBorder(card.rarity),
              "hover:bg-bg-hover/40 hover:border-border/70 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
            )}
          >
            {/* Thumbnail */}
            {thumb ? (
              <Image
                src={thumb}
                alt={card.name}
                width={30}
                height={42}
                className="flex-shrink-0 rounded-sm"
              />
            ) : (
              <div className="flex h-[42px] w-[30px] flex-shrink-0 items-center justify-center rounded-sm bg-bg-secondary text-[8px] text-text-secondary">
                ?
              </div>
            )}

            {/* Name & type */}
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-primary leading-snug">
                {card.name}
              </span>
              <span className="block truncate text-xs text-text-secondary mt-0.5">
                {card.type_line}
              </span>
            </div>

            {/* Mana cost */}
            {manaCost && (
              <ManaCost cost={manaCost} className="flex-shrink-0" />
            )}

            {/* Price */}
            <span className="flex-shrink-0 text-xs font-semibold text-accent tabular-nums min-w-[40px] text-right">
              {price ? formatPrice(price) : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
