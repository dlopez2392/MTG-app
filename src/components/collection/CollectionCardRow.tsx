"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import Badge from "@/components/ui/Badge";
import type { CollectionCard } from "@/types/collection";
import { CONDITIONS } from "@/lib/constants";

interface CollectionCardRowProps {
  card: CollectionCard;
  onQuantityChange: (id: string, newQty: number) => void;
  onRemove: (id: string) => void;
  onCardClick?: () => void;
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
    <div className="flex items-center gap-3 p-3 bg-bg-card rounded-lg border border-border">
      {/* Card image + details — clickable area */}
      <button
        onClick={onCardClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 active:opacity-60 transition-opacity"
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
              <svg
                className="w-5 h-5 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-primary truncate">
              {card.name}
            </span>
            {card.isFoil && (
              <span className="text-[10px] font-bold text-accent-light bg-accent/20 px-1 rounded">
                FOIL
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {card.setCode && (
              <span className="text-xs text-text-muted uppercase">
                {card.setCode}
              </span>
            )}
            <Badge className="text-[10px]">{conditionLabel}</Badge>
          </div>
          <div className="text-xs text-accent mt-0.5">
            ${totalPrice.toFixed(2)}
            {card.quantity > 1 && (
              <span className="text-text-muted ml-1">
                (${price.toFixed(2)} ea)
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Quantity controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => {
            if (card.quantity <= 1) {
              onRemove(card.id!);
            } else {
              onQuantityChange(card.id!, card.quantity - 1);
            }
          }}
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold transition-colors",
            card.quantity <= 1
              ? "bg-banned/20 text-banned hover:bg-banned/30"
              : "bg-bg-hover text-text-primary hover:bg-bg-secondary"
          )}
        >
          {card.quantity <= 1 ? (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          ) : (
            "-"
          )}
        </button>
        <span className="w-7 text-center text-sm font-semibold text-text-primary">
          {card.quantity}
        </span>
        <button
          onClick={() => onQuantityChange(card.id!, card.quantity + 1)}
          className="w-7 h-7 rounded-md bg-bg-hover flex items-center justify-center text-sm font-bold text-text-primary hover:bg-bg-secondary transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
