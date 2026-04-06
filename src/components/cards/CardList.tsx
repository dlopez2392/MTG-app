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

export default function CardList({ cards, onCardClick, className }: CardListProps) {
  if (cards.length === 0) return null;

  return (
    <div className={cn("divide-y divide-border", className)}>
      {cards.map((card) => {
        const thumb = getSmallImageUrl(card);
        const manaCost = getManaCost(card);
        const price = card.prices.usd ?? card.prices.usd_foil;

        return (
          <button
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
              <span className="block truncate text-sm font-medium text-text-primary">
                {card.name}
              </span>
              <span className="block truncate text-xs text-text-secondary">
                {card.type_line}
              </span>
            </div>

            {/* Mana cost */}
            {manaCost && (
              <ManaCost cost={manaCost} className="flex-shrink-0" />
            )}

            {/* Price */}
            <span className="flex-shrink-0 text-xs font-medium text-accent">
              {price ? formatPrice(price) : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
