"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDecks } from "@/hooks/useDecks";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import DeckGrid from "@/components/decks/DeckGrid";
import ExploreDecks from "@/components/decks/ExploreDecks";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Tabs from "@/components/ui/Tabs";
import type { Deck } from "@/types/deck";

const DECK_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const FORMAT_OPTIONS = [
  { value: "", label: "All Formats" },
  { value: "commander", label: "Commander" },
  { value: "standard", label: "Standard" },
  { value: "modern", label: "Modern" },
  { value: "pioneer", label: "Pioneer" },
  { value: "pauper", label: "Pauper" },
  { value: "legacy", label: "Legacy" },
  { value: "vintage", label: "Vintage" },
];

export default function DecksPageClient() {
  const router = useRouter();
  const { allDecks, deleteDeck } = useDecks();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"decks" | "explore">("decks");
  const [formatFilter, setFormatFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

  const filteredDecks = (allDecks ?? []).filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (formatFilter && d.format !== formatFilter) return false;
    return true;
  });

  function handleDeckClick(deck: Deck) {
    router.push(`/decks/${deck.id}`);
  }

  function handleDeckDelete(deck: Deck) {
    setDeckToDelete(deck);
  }

  async function confirmDeckDelete() {
    if (!deckToDelete) return;
    await deleteDeck(deckToDelete.id!);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <HeroBanner
        title="Decks"
        subtitle="Build & manage your decks"
        accent="#ED9A57"
        icon={DECK_ICON}
      />

      <PageContainer>
        <Tabs
          tabs={[
            { value: "decks", label: "Decks" },
            { value: "explore", label: "Explore" },
          ]}
          active={tab}
          onChange={(v) => setTab(v as "decks" | "explore")}
          className="mb-4"
        />

        {tab === "decks" ? (
          <>
            {/* Search + Filter row */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
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
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 rounded-xl border transition-colors flex items-center gap-1.5 shrink-0 ${
                  showFilters || formatFilter
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "bg-bg-card border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Filter</span>
                {formatFilter && (
                  <span className="w-4 h-4 rounded-full bg-accent text-black text-[10px] font-bold flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Filter dropdown */}
            {showFilters && (
              <div className="mb-4 p-3 rounded-xl glass-card border border-border space-y-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Format</label>
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="w-full bg-bg-primary border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/60 transition-colors"
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {formatFilter && (
                  <button
                    onClick={() => setFormatFilter("")}
                    className="text-xs text-accent hover:text-accent-light transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

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
                title={search || formatFilter ? "No matching decks" : "No decks yet"}
                description={search || formatFilter ? "Try different search or filter" : "Create your first deck to get started"}
              />
            ) : (
              <DeckGrid decks={filteredDecks} onDeckClick={handleDeckClick} onDeckDelete={handleDeckDelete} />
            )}
          </>
        ) : (
          <ExploreDecks />
        )}

        <ConfirmModal
          open={!!deckToDelete}
          onClose={() => setDeckToDelete(null)}
          onConfirm={confirmDeckDelete}
          title="Delete Deck"
          description={`Delete "${deckToDelete?.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
        />

        {/* FAB - Create New Deck (only on decks tab) */}
        {tab === "decks" && (
          <button
            onClick={() => router.push("/decks/new")}
            className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full btn-gradient flex items-center justify-center transition-colors"
            aria-label="Create new deck"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </PageContainer>
    </div>
  );
}
