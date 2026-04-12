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
  small:  { width: 146, height: 204 },
  normal: { width: 488, height: 680 },
  large:  { width: 672, height: 936 },
} as const;

function getImageUri(card: ScryfallCard, face: number, size: "small" | "normal" | "large"): string | null {
  if (card.image_uris) return card.image_uris[size];
  if (card.card_faces?.[face]?.image_uris) return card.card_faces[face].image_uris![size];
  return null;
}

function isDFC(card: ScryfallCard): boolean {
  return !card.image_uris && !!card.card_faces && card.card_faces.length > 1 && !!card.card_faces[0]?.image_uris;
}

export default function CardImage({ card, size = "normal", className }: CardImageProps) {
  const [activeFace, setActiveFace] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const { width, height } = IMAGE_DIMENSIONS[size];
  const imageUri = getImageUri(card, activeFace, size);

  if (!imageUri) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-lg bg-bg-card text-text-secondary text-caption", className)}
        style={{ width, height }}
      >
        No image
      </div>
    );
  }

  return (
    <div
      className={cn("relative inline-block rounded-lg overflow-hidden", className)}
      style={{ width, height }}
    >
      {/* Shimmer skeleton — sits behind the image, fades out once loaded */}
      <div
        className={cn(
          "absolute inset-0 skeleton-shimmer rounded-lg transition-opacity duration-500",
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      />

      {/* Card image — fades in from transparent */}
      <Image
        src={imageUri}
        alt={card.name}
        width={width}
        height={height}
        preload={size === "large"}
        className={cn(
          "rounded-lg transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />

      {/* Flip button for double-faced cards */}
      {isDFC(card) && loaded && (
        <button
          onClick={() => { setLoaded(false); setActiveFace((f) => (f === 0 ? 1 : 0)); }}
          className="absolute bottom-2 right-2 rounded-full bg-bg-primary/80 px-3 py-1.5 text-xs font-medium text-text-primary backdrop-blur-sm transition-colors hover:bg-accent hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Flip card"
        >
          Flip
        </button>
      )}
    </div>
  );
}
