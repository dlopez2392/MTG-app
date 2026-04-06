"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/prices";
import type { ScryfallCard } from "@/types/card";

interface CardGridProps {
  cards: ScryfallCard[];
  onCardClick?: (card: ScryfallCard) => void;
  className?: string;
}

function getArtCropUrl(card: ScryfallCard): string | null {
  if (card.image_uris) return card.image_uris.art_crop;
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris.art_crop;
  return null;
}

export default function CardGrid({ cards, onCardClick, className }: CardGridProps) {
  if (cards.length === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
        className
      )}
    >
      {cards.map((card) => {
        const artCrop = getArtCropUrl(card);
        const price = card.prices.usd ?? card.prices.usd_foil;

        return (
          <button
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className="group relative overflow-hidden rounded-lg bg-bg-card transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {artCrop ? (
              <Image
                src={artCrop}
                alt={card.name}
                width={300}
                height={214}
                className="aspect-[300/214] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[300/214] w-full items-center justify-center bg-bg-secondary text-xs text-text-secondary">
                No image
              </div>
            )}

            {/* Name overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
              <span className="block truncate text-xs font-medium text-white">
                {card.name}
              </span>
            </div>

            {/* Price badge */}
            {price && (
              <span className="absolute right-1 top-1 rounded bg-bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-accent backdrop-blur-sm">
                {formatPrice(price)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
