"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCollection } from "@/hooks/useCollection";
import CollectionCardRow from "@/components/collection/CollectionCardRow";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  binderId: string;
}

export default function BinderDetailClient({ binderId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { allBinders, binderCards, updateQuantity, removeFromCollection } = useCollection(binderId);

  const binder = allBinders.find((b) => b.id === binderId);

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
    () => binderCards.reduce((sum, c) => sum + parseFloat(c.priceUsd ?? "0") * c.quantity, 0),
    [binderCards]
  );

  const totalCards = useMemo(
    () => binderCards.reduce((sum, c) => sum + c.quantity, 0),
    [binderCards]
  );

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-secondary">
        <Link href="/collection" className="text-text-muted hover:text-text-primary transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-primary truncate">
            {binder?.name ?? "Loading..."}
          </h1>
          <p className="text-xs text-text-muted">
            {totalCards} {totalCards === 1 ? "card" : "cards"} &middot; ${totalValue.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        <Input
          placeholder="Search in binder..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>

      {/* Add Cards FAB */}
      <button
        onClick={() => router.push(`/search?binderId=${binderId}`)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-accent hover:bg-accent-dark text-black flex items-center justify-center shadow-lg transition-colors"
        aria-label="Add cards"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      <div className="flex-1 px-4 space-y-2">
        {filteredCards.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            }
            title={search ? "No matches" : "Binder is empty"}
            description={search ? "Try a different search term." : "Add cards from the search page to this binder."}
          />
        ) : (
          filteredCards.map((card) => (
            <CollectionCardRow
              key={card.id}
              card={card}
              onQuantityChange={(id, qty) => updateQuantity(id, qty)}
              onRemove={(id) => removeFromCollection(id)}
              onCardClick={() => router.push(`/search/${card.scryfallId}?binderId=${binderId}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
