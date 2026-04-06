"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDecks } from "@/hooks/useDecks";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import DeckGrid from "@/components/decks/DeckGrid";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import type { Deck } from "@/types/deck";

export default function DecksPageClient() {
  const router = useRouter();
  const { allDecks } = useDecks();
  const [search, setSearch] = useState("");

  const filteredDecks = (allDecks ?? []).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleDeckClick(deck: Deck) {
    router.push(`/decks/${deck.id}`);
  }

  return (
    <>
      <TopBar title="Decks" />
      <PageContainer>
        <div className="mb-4">
          <Input
            placeholder="Search decks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </div>

        {allDecks === undefined ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDecks.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            }
            title={search ? "No matching decks" : "No decks yet"}
            description={search ? "Try a different search term" : "Create your first deck to get started"}
          />
        ) : (
          <DeckGrid decks={filteredDecks} onDeckClick={handleDeckClick} />
        )}

        {/* FAB - Create New Deck */}
        <button
          onClick={() => router.push("/decks/new")}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-accent text-black shadow-lg hover:bg-accent-dark transition-colors flex items-center justify-center"
          aria-label="Create new deck"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </PageContainer>
    </>
  );
}
