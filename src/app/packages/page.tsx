"use client";

import { Suspense } from "react";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import HeroBanner from "@/components/layout/HeroBanner";
import { useDecks } from "@/hooks/useDecks";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import {
  CARD_PACKAGES, PACKAGE_CATEGORIES, CATEGORY_COLORS,
  type CardPackage, type PackageCategory,
} from "@/lib/packages/staples";

// ── Scryfall helpers ──────────────────────────────────────────────────────────
interface ScryfallCardMin {
  id: string;
  name: string;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
  mana_cost?: string;
  type_line?: string;
  rarity?: string;
  prices?: { usd?: string | null };
  cmc?: number;
}

async function fetchPackageCards(names: string[]): Promise<ScryfallCardMin[]> {
  const identifiers = names.map((name) => ({ name }));
  const res = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifiers }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

function getSmall(card: ScryfallCardMin): string | null {
  return card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? null;
}

// ── Color pip SVG ─────────────────────────────────────────────────────────────
const MTG_COLOR_BG: Record<string, string> = {
  W: "#F9FAF0", U: "#0E68AB", B: "#150B00", R: "#D3202A", G: "#00733E",
};
function ColorPip({ color }: { color: string }) {
  return (
    <span
      className="inline-flex w-4 h-4 rounded-full border border-black/20 text-[8px] font-bold items-center justify-center text-white"
      style={{ background: MTG_COLOR_BG[color] ?? "#888", color: color === "W" ? "#333" : "#fff" }}
    >
      {color}
    </span>
  );
}

// ── Package card component ────────────────────────────────────────────────────
function PackageCard({
  pkg,
  deckId,
  onAdd,
}: {
  pkg: CardPackage;
  deckId: string | null;
  onAdd: (pkg: CardPackage, cards: ScryfallCardMin[]) => Promise<void>;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [cards, setCards]           = useState<ScryfallCardMin[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [adding, setAdding]         = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const accentColor = CATEGORY_COLORS[pkg.category];

  async function handleExpand() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (cards.length === 0) {
      setLoadingCards(true);
      const fetched = await fetchPackageCards(pkg.cardNames);
      setCards(fetched);
      setLoadingCards(false);
    }
  }

  async function handleAdd() {
    if (!deckId || adding) return;
    setAdding(true);
    let fetched = cards;
    if (fetched.length === 0) {
      setLoadingCards(true);
      fetched = await fetchPackageCards(pkg.cardNames);
      setCards(fetched);
      setLoadingCards(false);
    }
    await onAdd(pkg, fetched);
    setAddedCount(fetched.length);
    setAdding(false);
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Color badge */}
        <div
          className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: `${accentColor}22` }}
        >
          {pkg.colors.length > 0 ? (
            <div className="flex flex-wrap gap-0.5 justify-center">
              {pkg.colors.map((c) => <ColorPip key={c} color={c} />)}
            </div>
          ) : (
            <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          )}
        </div>

        {/* Title & meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text-primary">{pkg.name}</h3>
            <span
              className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: `${accentColor}22`, color: accentColor }}
            >
              {pkg.category}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{pkg.description}</p>
          <p className="text-[10px] text-text-muted mt-1">{pkg.cardNames.length} cards</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={handleExpand}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border/70 transition-colors"
        >
          {loadingCards ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg
              className={cn("w-3.5 h-3.5 transition-transform duration-200", expanded ? "rotate-180" : "")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {expanded ? "Hide" : "Preview"}
        </button>

        {deckId && (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-bold hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {adding ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : addedCount > 0 ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            {addedCount > 0 ? `Added ${addedCount}` : "Add to Deck"}
          </button>
        )}
      </div>

      {/* Preview grid */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {loadingCards ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: pkg.cardNames.length }).map((_, i) => (
                <div key={i} className="aspect-[2.5/3.5] rounded bg-bg-secondary animate-pulse" />
              ))}
            </div>
          ) : cards.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
              {cards.map((card) => {
                const img = getSmall(card);
                return (
                  <div key={card.id} className="relative group" title={card.name}>
                    {img ? (
                      <Image
                        src={img}
                        alt={card.name}
                        width={74}
                        height={103}
                        className="w-full rounded"
                      />
                    ) : (
                      <div className="aspect-[2.5/3.5] rounded bg-bg-secondary flex items-center justify-center">
                        <span className="text-[8px] text-text-muted text-center px-1">{card.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent rounded-b px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] text-white leading-tight block truncate">{card.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">Could not load card images.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function PackagesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const deckId = searchParams.get("deckId");
  const [activeCategory, setActiveCategory] = useState<PackageCategory | "All">("All");
  const { addCardToDeck } = useDecks();
  const { toast, showToast } = useToast();

  const filtered = activeCategory === "All"
    ? CARD_PACKAGES
    : CARD_PACKAGES.filter((p) => p.category === activeCategory);

  const handleAdd = useCallback(async (pkg: CardPackage, cards: ScryfallCardMin[]) => {
    if (!deckId) return;
    for (const card of cards) {
      await addCardToDeck(deckId, card as never, "main", 1);
    }
    showToast(`Added ${pkg.name} (${cards.length} cards)`);
  }, [deckId, addCardToDeck, showToast]);

  const PUZZLE_ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Card Packages"
        subtitle={deckId ? "Add staple bundles to your deck" : "Curated Commander staple packages"}
        accent="#F59E0B"
        icon={PUZZLE_ICON}
      />

      <PageContainer>
        {deckId && (
          <div className="mb-4 flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-sm text-accent font-medium flex-1">Adding to deck</span>
            <button
              onClick={() => router.push(`/decks/${deckId}`)}
              className="text-xs text-accent/70 hover:text-accent transition-colors"
            >
              ← Back to deck
            </button>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none -mx-1 px-1">
          {(["All", ...PACKAGE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as PackageCategory | "All")}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeCategory === cat
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-bg-card border border-border text-text-secondary hover:text-text-primary"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Package list */}
        <div className="flex flex-col gap-3">
          {filtered.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              deckId={deckId}
              onAdd={handleAdd}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-text-muted text-sm py-12">No packages in this category.</p>
        )}
      </PageContainer>

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}

export default function PackagesPage() {
  return (
    <Suspense>
      <PackagesPageInner />
    </Suspense>
  );
}
