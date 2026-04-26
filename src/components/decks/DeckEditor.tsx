"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDeckCards, useDecks } from "@/hooks/useDecks";
import { useToast } from "@/hooks/useToast";
import { useCollectionMap } from "@/hooks/useCollectionMap";
import { cn } from "@/lib/utils/cn";
import { formatPrice, getPriceValue } from "@/lib/utils/prices";
import { groupCards, sortCards } from "@/lib/utils/deckGrouping";
import type { GroupBy, SortBy, SortDir } from "@/lib/utils/deckGrouping";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";
import DeckCardRow from "./DeckCardRow";
import DeckCardGrid from "./DeckCardGrid";
import DeckImportExport from "./DeckImportExport";
import HandSimulator from "./HandSimulator";
import type { DeckCard, DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

const CATEGORY_TABS = [
  { value: "main",       label: "Main"      },
  { value: "sideboard",  label: "Sideboard" },
  { value: "commander",  label: "Commander" },
  { value: "maybeboard", label: "Maybe"     },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "type",   label: "Type" },
  { value: "cmc",    label: "CMC" },
  { value: "color",  label: "Color" },
  { value: "rarity", label: "Rarity" },
  { value: "none",   label: "None" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name",   label: "Name" },
  { value: "cmc",    label: "CMC" },
  { value: "price",  label: "Price" },
  { value: "color",  label: "Color" },
  { value: "type",   label: "Type" },
  { value: "rarity", label: "Rarity" },
];

type ViewMode = "list" | "grid";

interface DeckEditorProps {
  deckId: string;
}

const RARITY_BAR: { key: string; label: string; color: string }[] = [
  { key: "mythic",   label: "M", color: "#D3202A" },
  { key: "rare",     label: "R", color: "#D4A843" },
  { key: "uncommon", label: "U", color: "#94A3B8" },
  { key: "common",   label: "C", color: "#6B7280" },
];

export default function DeckEditor({ deckId }: DeckEditorProps) {
  const router = useRouter();
  const { cards, updateCardQuantity, removeCardFromDeck, refresh } = useDeckCards(deckId);
  const { addCardToDeck } = useDecks();
  const { toast, showToast } = useToast();
  const collectionMap = useCollectionMap();

  const [activeTab, setActiveTab]     = useState<string>("main");
  const [viewMode, setViewMode]       = useState<ViewMode>("list");
  const [groupBy, setGroupBy]         = useState<GroupBy>("type");
  const [sortBy, setSortBy]           = useState<SortBy>("name");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [search, setSearch]           = useState("");
  const [showImportExport, setShowImportExport] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  const filteredCards = useMemo(() => {
    let result = cards?.filter((c) => c.category === activeTab) ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.typeLine?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [cards, activeTab, search]);

  const totalCards = cards?.filter((c) => c.category !== "maybeboard").reduce((sum, c) => sum + c.quantity, 0) ?? 0;
  const totalValue = cards?.filter((c) => c.category !== "maybeboard").reduce((sum, c) => sum + getPriceValue(c.priceUsd) * c.quantity, 0) ?? 0;

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const mainCards = cards?.filter((c) => c.category !== "maybeboard") ?? [];
    for (const c of mainCards) {
      const r = c.rarity ?? "common";
      counts[r] = (counts[r] ?? 0) + c.quantity;
    }
    return counts;
  }, [cards]);

  const groups = useMemo(() => {
    const sorted = sortCards(filteredCards, sortBy, sortDir);
    return groupCards(sorted, groupBy);
  }, [filteredCards, groupBy, sortBy, sortDir]);

  const handleQuantityChange = useCallback((id: string, qty: number) => {
    updateCardQuantity(id, qty);
    const card = cards?.find((c) => c.id === id);
    if (card) showToast(`${card.name} · ${qty}×`);
  }, [updateCardQuantity, cards, showToast]);

  const toggleSort = (key: SortBy) => {
    if (sortBy === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("asc"); }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Value & Rarity Summary ── */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-text-primary tabular-nums">{totalCards}</span>
          <span className="text-xs text-text-muted">cards</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold text-accent tabular-nums">${totalValue.toFixed(2)}</span>
        </div>
        <div className="flex-1" />
        {/* Rarity pills */}
        <div className="flex items-center gap-1">
          {RARITY_BAR.map(({ key, label, color }) => {
            const count = rarityCounts[key] ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {label} {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter cards..."
            className="w-full input-base text-xs pl-7 pr-2 py-1.5 rounded-lg"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort/Group toggle */}
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className={cn(
            "p-1.5 rounded-lg border transition-colors",
            showToolbar ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-text-muted hover:text-text-primary"
          )}
          title="Sort & Group"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
        </button>

        {/* View toggle */}
        <div className="flex items-center bg-bg-card border border-border rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode("list")}
            title="List view"
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === "list" ? "btn-gradient" : "text-text-muted hover:text-text-primary"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === "grid" ? "btn-gradient" : "text-text-muted hover:text-text-primary"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => router.push(`/packages?deckId=${deckId}`)}
          title="Card packages"
          className="p-1.5 text-text-muted hover:text-accent transition-colors rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
          </svg>
        </button>

        <button
          onClick={() => setShowSimulator(true)}
          title="Hand simulator"
          className="p-1.5 text-text-muted hover:text-accent transition-colors rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
          </svg>
        </button>

        <button
          onClick={() => setShowImportExport(true)}
          title="Import/Export"
          className="p-1.5 text-text-muted hover:text-accent transition-colors rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </button>

        <button
          onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg btn-gradient transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
      </div>

      {/* ── Sort/Group Toolbar (collapsible) ── */}
      {showToolbar && (
        <div className="flex flex-col gap-2 p-3 bg-bg-card rounded-xl border border-border">
          {/* Group by */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold w-12">Group</span>
            <div className="flex flex-wrap gap-1">
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt.value)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-semibold rounded-md transition-colors",
                    groupBy === opt.value
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-text-muted hover:text-text-secondary border border-transparent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Sort by */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold w-12">Sort</span>
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleSort(opt.value)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-0.5",
                    sortBy === opt.value
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-text-muted hover:text-text-secondary border border-transparent"
                  )}
                >
                  {opt.label}
                  {sortBy === opt.value && (
                    <svg className={cn("w-2.5 h-2.5 transition-transform", sortDir === "desc" && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Category Tabs ── */}
      <Tabs tabs={CATEGORY_TABS} active={activeTab} onChange={setActiveTab} />

      {/* ── Card List / Grid ── */}
      {filteredCards.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-body text-text-muted">
            {search ? "No matching cards" : `No cards in ${activeTab === "main" ? "mainboard" : activeTab === "maybeboard" ? "maybeboard" : activeTab}`}
          </p>
          {!search && (
            <button
              onClick={() => router.push(`/search?deckId=${deckId}&category=${activeTab}`)}
              className="mt-2 text-sm text-accent hover:text-accent-dark transition-colors"
            >
              Search for cards to add
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-0.5">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group header — Moxfield style */}
              {groupBy !== "none" && (
                <div className="flex items-center gap-2 px-2 py-1.5 mt-1 first:mt-0">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-semibold text-text-muted tabular-nums">
                    ({group.totalQty})
                  </span>
                  {group.totalPrice > 0 && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="text-[11px] text-accent/70 tabular-nums font-medium">
                        ${group.totalPrice.toFixed(2)}
                      </span>
                    </>
                  )}
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              )}
              {group.cards.map((card) => (
                <DeckCardRow
                  key={card.id}
                  card={card}
                  onQuantityChange={handleQuantityChange}
                  onRemove={removeCardFromDeck}
                  onCardClick={() => router.push(`/search/${card.scryfallId}?deckId=${deckId}&category=${activeTab}`)}
                  ownedQty={collectionMap.get(card.scryfallId)}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.label}>
              {groupBy !== "none" && (
                <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-semibold text-text-muted tabular-nums">
                    ({group.totalQty})
                  </span>
                  {group.totalPrice > 0 && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="text-[11px] text-accent/70 tabular-nums font-medium">
                        ${group.totalPrice.toFixed(2)}
                      </span>
                    </>
                  )}
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              )}
              <DeckCardGrid
                cards={group.cards}
                onQuantityChange={handleQuantityChange}
                onRemove={removeCardFromDeck}
                onCardClick={(card) => router.push(`/search/${card.scryfallId}?deckId=${deckId}&category=${activeTab}`)}
              />
            </div>
          ))}
        </div>
      )}

      <DeckImportExport
        open={showImportExport}
        onClose={() => { setShowImportExport(false); refresh(); }}
        deckId={deckId}
        cards={cards ?? []}
        onImportCards={async (card: Partial<ScryfallCard>, category: DeckCard["category"], quantity: number) => {
          await addCardToDeck(deckId, card, category, quantity);
        }}
      />

      <Toast message={toast.message} visible={toast.visible} />

      <HandSimulator
        open={showSimulator}
        onClose={() => setShowSimulator(false)}
        cards={cards ?? []}
      />
    </div>
  );
}
