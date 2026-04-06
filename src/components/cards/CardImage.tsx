"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { ScryfallCard } from "@/types/card";

interface CardImageProps {
  card: ScryfallCard;
  size?: "small" | "normal" | "large";
  className?: string;
}

const IMAGE_DIMENSIONS = {
  small: { width: 146, height: 204 },
  normal: { width: 488, height: 680 },
  large: { width: 672, height: 936 },
} as const;

function getImageUri(card: ScryfallCard, face: number, size: "small" | "normal" | "large"): string | null {
  if (card.image_uris) {
    return card.image_uris[size];
  }
  if (card.card_faces?.[face]?.image_uris) {
    return card.card_faces[face].image_uris![size];
  }
  return null;
}

function isDFC(card: ScryfallCard): boolean {
  return !card.image_uris && !!card.card_faces && card.card_faces.length > 1 && !!card.card_faces[0]?.image_uris;
}

export default function CardImage({ card, size = "normal", className }: CardImageProps) {
  const [activeFace, setActiveFace] = useState(0);
  const { width, height } = IMAGE_DIMENSIONS[size];
  const imageUri = getImageUri(card, activeFace, size);

  if (!imageUri) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-bg-card text-text-secondary",
          className
        )}
        style={{ width, height }}
      >
        No image
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", className)}>
      <Image
        src={imageUri}
        alt={card.name}
        width={width}
        height={height}
        preload={size === "large"}
        className="rounded-lg"
      />
      {isDFC(card) && (
        <button
          onClick={() => setActiveFace((f) => (f === 0 ? 1 : 0))}
          className="absolute bottom-2 right-2 rounded-full bg-bg-primary/80 px-3 py-1.5 text-xs font-medium text-text-primary backdrop-blur-sm transition-colors hover:bg-accent hover:text-black"
          aria-label="Flip card"
        >
          Flip
        </button>
      )}
    </div>
  );
}
