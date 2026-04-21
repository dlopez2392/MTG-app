"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/prices";
import { getLegalityBadge } from "@/lib/utils/legality";
import ManaCost from "@/components/cards/ManaCost";
import type { ScryfallCard } from "@/types/card";

interface CardListProps {
  cards: ScryfallCard[];
  onCardClick?: (card: ScryfallCard) => void;
  className?: string;
  collectionMap?: Map<string, number>;
  deckFormat?: string;
}

function getImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris.normal;
  return null;
}

function getManaCost(card: ScryfallCard): string | undefined {
  if (card.mana_cost) return card.mana_cost;
  if (card.card_faces?.[0]?.mana_cost) return card.card_faces[0].mana_cost;
  return undefined;
}

function getOracleText(card: ScryfallCard): string | undefined {
  if (card.oracle_text) return card.oracle_text;
  if (card.card_faces?.[0]?.oracle_text) return card.card_faces[0].oracle_text;
  return undefined;
}

function rarityColor(rarity?: string): string {
  switch (rarity) {
    case "mythic":   return "text-accent";
    case "rare":     return "text-mtg-gold";
    case "uncommon": return "text-[#94A3B8]";
    default:         return "text-text-muted";
  }
}

function rarityBorder(rarity?: string): string {
  switch (rarity) {
    case "mythic":   return "border-l-accent";
    case "rare":     return "border-l-mtg-gold";
    case "uncommon": return "border-l-[#94A3B8]";
    default:         return "border-l-border";
  }
}

export default function CardList({ cards, onCardClick, className, collectionMap, deckFormat }: CardListProps) {
  if (cards.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {cards.map((card) => {
        const image = getImageUrl(card);
        const manaCost = getManaCost(card);
        const oracleText = getOracleText(card);
        const price = card.prices.usd ?? card.prices.usd_foil;
        const owned = collectionMap?.get(card.id) ?? 0;
        const legalityBadge = deckFormat
          ? getLegalityBadge(card.legalities?.[deckFormat] as Parameters<typeof getLegalityBadge>[0])
          : null;
        const hasStats = card.power != null && card.toughness != null;

        return (
          <button
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className={cn(
              "group flex w-full items-start gap-3 p-3 text-left rounded-xl",
              "bg-bg-card border border-border border-l-2",
              rarityBorder(card.rarity),
              "hover:bg-bg-hover/40 hover:border-border/70 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
            )}
          >
            {/* Card image */}
            {image ? (
              <Image
                src={image}
                alt={card.name}
                width={120}
                height={167}
                className="flex-shrink-0 rounded-lg shadow-md"
              />
            ) : (
              <div className="flex h-[167px] w-[120px] flex-shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-sm text-text-secondary">
                ?
              </div>
            )}

            {/* Card details */}
            <div className="min-w-0 flex-1 py-0.5">
              {/* Name + mana cost */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-text-primary leading-snug">
                  {card.name}
                </h3>
                {manaCost && (
                  <ManaCost cost={manaCost} className="flex-shrink-0 mt-0.5" />
                )}
              </div>

              {/* Type line */}
              <p className="text-xs text-text-secondary mt-0.5 truncate">
                {card.type_line}
              </p>

              {/* Oracle text */}
              {oracleText && (
                <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed line-clamp-3 whitespace-pre-line">
                  {oracleText}
                </p>
              )}

              {/* Stats + set + rarity + price row */}
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                {hasStats && (
                  <span className="text-xs font-bold text-text-primary">
                    {card.power}/{card.toughness}
                  </span>
                )}
                {card.loyalty && (
                  <span className="text-xs font-bold text-text-primary">
                    Loyalty: {card.loyalty}
                  </span>
                )}
                <span className="text-[10px] text-text-muted uppercase tracking-wide">
                  {card.set_name}
                </span>
                <span className={cn("text-[10px] font-bold uppercase tracking-wide", rarityColor(card.rarity))}>
                  {card.rarity}
                </span>
                {legalityBadge && (
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded",
                    legalityBadge.classes
                  )}>
                    {legalityBadge.label}
                  </span>
                )}
                {collectionMap && (
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums",
                    owned > 0
                      ? "bg-legal/20 text-legal"
                      : "bg-bg-hover text-text-muted"
                  )}>
                    {owned > 0 ? `${owned}×` : "0×"}
                  </span>
                )}
                {price && (
                  <span className="text-xs font-semibold text-accent tabular-nums ml-auto">
                    {formatPrice(price)}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
