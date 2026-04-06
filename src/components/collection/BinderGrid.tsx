"use client";

import BinderCard from "./BinderCard";
import EmptyState from "@/components/ui/EmptyState";
import type { Binder, CollectionCard } from "@/types/collection";

interface BinderGridProps {
  binders: Binder[];
  allCards: CollectionCard[];
}

export default function BinderGrid({ binders, allCards }: BinderGridProps) {
  if (binders.length === 0) {
    return (
      <EmptyState
        icon={
          <svg
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        }
        title="No Binders Yet"
        description="Create your first binder to start organizing your collection."
      />
    );
  }

  // Pre-compute card counts and values per binder
  const binderStats = new Map<
    number,
    { count: number; value: number; coverImage?: string }
  >();

  for (const card of allCards) {
    const stats = binderStats.get(card.binderId) ?? {
      count: 0,
      value: 0,
      coverImage: undefined,
    };
    stats.count += card.quantity;
    stats.value += parseFloat(card.priceUsd ?? "0") * card.quantity;
    if (!stats.coverImage && card.imageUri) {
      stats.coverImage = card.imageUri;
    }
    binderStats.set(card.binderId, stats);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {binders.map((binder) => {
        const stats = binderStats.get(binder.id!) ?? {
          count: 0,
          value: 0,
          coverImage: undefined,
        };
        return (
          <BinderCard
            key={binder.id}
            id={binder.id!}
            name={binder.name}
            cardCount={stats.count}
            totalValue={stats.value}
            coverImageUri={stats.coverImage ?? binder.coverImageUri}
          />
        );
      })}
    </div>
  );
}
