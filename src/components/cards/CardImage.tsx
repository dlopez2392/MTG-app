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

// Aspect ratios as CSS values
const ASPECT_RATIOS = {
  small:  "146 / 204",
  normal: "488 / 680",
  large:  "672 / 936",
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
  const [errored, setErrored] = useState(false);
  const { width, height } = IMAGE_DIMENSIONS[size];
  const imageUri = getImageUri(card, activeFace, size);

  if (!imageUri || errored) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg bg-bg-card border border-border text-caption text-text-secondary w-full p-2 text-center",
          className
        )}
        style={{ aspectRatio: ASPECT_RATIOS[size] }}
      >
        <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
        </svg>
        <span className="line-clamp-2">{card.name}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("relative rounded-lg overflow-hidden w-full", className)}
      style={{ aspectRatio: ASPECT_RATIOS[size] }}
    >
      {/* Shimmer skeleton */}
      <div
        className={cn(
          "absolute inset-0 skeleton-shimmer transition-opacity duration-500",
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      />

      {/* Card image — fill the aspect-ratio container */}
      <Image
        src={imageUri}
        alt={card.name}
        fill
        sizes={`(max-width: 640px) 100vw, ${width}px`}
        priority={size === "large"}
        className={cn(
          "object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />

      {/* Flip button for double-faced cards */}
      {isDFC(card) && loaded && (
        <button
          onClick={() => { setLoaded(false); setErrored(false); setActiveFace((f) => (f === 0 ? 1 : 0)); }}
          className="absolute bottom-2 right-2 rounded-full bg-bg-primary/80 px-3 py-1.5 text-xs font-medium text-text-primary backdrop-blur-sm transition-colors hover:bg-accent hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Flip card"
        >
          Flip
        </button>
      )}
    </div>
  );
}
