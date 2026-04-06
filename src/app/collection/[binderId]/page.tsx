"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/index";
import { useCollection } from "@/hooks/useCollection";
import CollectionCardRow from "@/components/collection/CollectionCardRow";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

interface BinderDetailPageProps {
  params: Promise<{ binderId: string }>;
}

export default function BinderDetailPage({ params }: BinderDetailPageProps) {
  const { binderId: binderIdStr } = use(params);
  const binderId = parseInt(binderIdStr, 10);

  const [search, setSearch] = useState("");

  const binder = useLiveQuery(
    () => db.binders.get(binderId),
    [binderId]
  );

  const { binderCards, updateQuantity, removeFromCollection } =
    useCollection(binderId);

  const filteredCards = useMemo(() => {
    if (!search.trim()) return binderCards;
    const q = search.toLowerCase();
    return binderCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.setCode?.toLowerCase().includes(q) ||
        c.setName?.toLowerCase().includes(q)
    );
  }, [binderCards, search]);

  const totalValue = useMemo(
    () =>
      binderCards.reduce(
        (sum, c) => sum + parseFloat(c.priceUsd ?? "0") * c.quantity,
        0
      ),
    [binderCards]
  );

  const totalCards = useMemo(
    () => binderCards.reduce((sum, c) => sum + c.quantity, 0),
    [binderCards]
  );

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-secondary">
        <Link
          href="/collection"
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-primary truncate">
            {binder?.name ?? "Loading..."}
          </h1>
          <p className="text-xs text-text-muted">
            {totalCards} {totalCards === 1 ? "card" : "cards"} &middot; $
            {totalValue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <Input
          placeholder="Search in binder..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Card list */}
      <div className="flex-1 px-4 space-y-2">
        {filteredCards.length === 0 ? (
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
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            }
            title={search ? "No matches" : "Binder is empty"}
            description={
              search
                ? "Try a different search term."
                : "Add cards from the search page to this binder."
            }
          />
        ) : (
          filteredCards.map((card) => (
            <CollectionCardRow
              key={card.id}
              card={card}
              onQuantityChange={(id, qty) => updateQuantity(id, qty)}
              onRemove={(id) => removeFromCollection(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
