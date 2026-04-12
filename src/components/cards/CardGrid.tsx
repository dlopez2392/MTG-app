"use client";

import { useState } from "react";
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

function CardGridItem({ card, onCardClick }: { card: ScryfallCard; onCardClick?: (card: ScryfallCard) => void }) {
  const [loaded, setLoaded] = useState(false);
  const artCrop = getArtCropUrl(card);
  const price = card.prices.usd ?? card.prices.usd_foil;

  return (
    <button
      onClick={() => onCardClick?.(card)}
      className="group relative overflow-hidden rounded-lg bg-bg-card transition-transform duration-150 hover:scale-105 active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Shimmer skeleton */}
      <div
        className={cn(
          "absolute inset-0 skeleton-shimmer transition-opacity duration-400",
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      />

      {artCrop ? (
        <Image
          src={artCrop}
          alt={card.name}
          width={300}
          height={214}
          className={cn(
            "aspect-[300/214] w-full object-cover transition-opacity duration-400",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="flex aspect-[300/214] w-full items-center justify-center bg-bg-secondary text-caption text-text-secondary">
          No image
        </div>
      )}

      {/* Name overlay — only show once image is loaded */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="block truncate text-xs font-medium text-white">
          {card.name}
        </span>
      </div>

      {/* Price badge */}
      {price && loaded && (
        <span className="absolute right-1 top-1 rounded bg-bg-primary/80 px-1.5 py-0.5 text-label text-accent backdrop-blur-sm">
          {formatPrice(price)}
        </span>
      )}
    </button>
  );
}

export default function CardGrid({ cards, onCardClick, className }: CardGridProps) {
  if (cards.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6", className)}>
      {cards.map((card) => (
        <CardGridItem key={card.id} card={card} onCardClick={onCardClick} />
      ))}
    </div>
  );
}
