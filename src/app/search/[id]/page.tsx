"use client";

import { Suspense } from "react";
import { useState, use, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import CardImage from "@/components/cards/CardImage";
import ManaCost from "@/components/cards/ManaCost";
import LegalityTable from "@/components/cards/LegalityTable";
import PriceTable from "@/components/cards/PriceTable";
import RulingsPanel from "@/components/cards/RulingsPanel";
import Tabs from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import { useCardDetail } from "@/hooks/useCardDetail";
import { useDecks } from "@/hooks/useDecks";
import { useCollection } from "@/hooks/useCollection";
import { useCardCombos } from "@/hooks/useCardCombos";
import CombosPanel from "@/components/cards/CombosPanel";
import CardPricesPanel from "@/components/cards/CardPricesPanel";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils/cn";
import type { DeckCategory } from "@/types/deck";

function CardDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { card, rulings, printings, loading, error } = useCardDetail(id);
  const { addCardToDeck } = useDecks();
  const { addCardToBinder } = useCollection();
  const { isOnWishlist, addItem: addToWishlist, removeItem: removeFromWishlist, items: wishlistItems } = useWishlist();
  const [activeTab, setActiveTab] = useState("versions");
  const comboState = useCardCombos(card?.name ?? "");

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === "combos") comboState.load();
  }, [comboState]);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [addedCollectionFeedback, setAddedCollectionFeedback] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "err">("idle");
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deckId = searchParams.get("deckId");
  const category = (searchParams.get("category") ?? "main") as DeckCategory;
  const binderId = searchParams.get("binderId");

  const handleAddToDeck = useCallback(async () => {
    if (!card || !deckId) return;
    await addCardToDeck(deckId, card, category);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  }, [card, deckId, category, addCardToDeck]);

  const handleAddToCollection = useCallback(async () => {
    if (!card || !binderId) return;
    const imageUri = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
    try {
      await addCardToBinder(binderId, {
        scryfallId: card.id,
        name: card.name,
        setCode: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        typeLine: card.type_line,
        rarity: card.rarity,
        imageUri,
        priceUsd: card.prices?.usd,
      });
      setAddedCollectionFeedback(true);
      setTimeout(() => setAddedCollectionFeedback(false), 1500);
    } catch (err) {
      alert(`Failed to add card: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [card, binderId, addCardToBinder]);

  const handleSaveImage = useCallback(async () => {
    const imageUrl =
      card?.image_uris?.normal ??
      card?.card_faces?.[0]?.image_uris?.normal;
    if (!imageUrl || savingImage) return;
    setSavingImage(true);
    try {
      // Proxy through our API to avoid CORS issues with Scryfall image CDN
      const proxyUrl = `/api/scryfall/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const filename = `${card!.name.replace(/[^a-z0-9]/gi, "_")}.jpg`;
      const file = new File([blob], filename, { type: "image/jpeg" });

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        // iOS Safari: share sheet lets user tap "Save Image" → Photos
        // navigator.share with files is supported on iOS 15+
        if (navigator.share) {
          await navigator.share({ files: [file], title: card!.name });
        } else {
          // Older iOS: open image in new tab — long-press → Save to Photos
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          URL.revokeObjectURL(url);
        }
      } else {
        // Android / Desktop: trigger direct download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setSaveStatus("ok");
    } catch (err) {
      // User cancelled the iOS share sheet — treat as success (not an error)
      const cancelled =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("cancel"));
      setSaveStatus(cancelled ? "ok" : "err");
    } finally {
      setSavingImage(false);
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [card, savingImage]);

  const handleShare = useCallback(async () => {
    if (!card || sharing) return;
    setSharing(true);
    const shareData = {
      title: card.name,
      text: `${card.name} · ${card.type_line} · ${card.set_name} (${card.set.toUpperCase()})`,
      url: card.scryfall_uri,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(card.scryfall_uri);
      }
    } catch {
      // user dismissed — no-op
    } finally {
      setSharing(false);
    }
  }, [card, sharing]);

  const wishlisted = card ? isOnWishlist(card.id) : false;
  const wishlistId = card ? wishlistItems.find((i) => i.scryfallId === card.id)?.id : undefined;

  const handleToggleWishlist = useCallback(() => {
    if (!card) return;
    if (wishlisted && wishlistId) {
      removeFromWishlist(wishlistId);
    } else {
      const imageUri = card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small;
      addToWishlist({
        scryfallId: card.id,
        name: card.name,
        imageUri,
        typeLine: card.type_line,
        manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
        rarity: card.rarity,
        priceUsd: card.prices?.usd ?? undefined,
      });
    }
  }, [card, wishlisted, wishlistId, addToWishlist, removeFromWishlist]);

  if (loading) {
    return (
      <>
        <TopBar title="Loading..." showBack />
        <PageContainer>
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="w-full sm:w-64 aspect-[488/680]" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </PageContainer>
      </>
    );
  }

  if (error || !card) {
    return (
      <>
        <TopBar title="Error" showBack />
        <PageContainer>
          <p className="text-banned">{error || "Card not found"}</p>
        </PageContainer>
      </>
    );
  }

  const oracleText = card.oracle_text || card.card_faces?.[0]?.oracle_text || "";
  const typeLine = card.type_line;
  const manaCost = card.mana_cost || card.card_faces?.[0]?.mana_cost || "";

  return (
    <>
      <TopBar title={card.name} showBack />
      <PageContainer>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Card Image + action buttons */}
          <div className="w-full max-w-[200px] mx-auto sm:mx-0 sm:w-44 flex-shrink-0 flex flex-col gap-2">
            <CardImage card={card} size="normal" />

            {/* Wishlist / Save / Share */}
            <div className="flex gap-2">
              {/* Wishlist */}
              <button
                onClick={handleToggleWishlist}
                title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                className={cn(
                  "flex items-center justify-center py-2 px-2.5 rounded-xl border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  wishlisted
                    ? "bg-pink-500/10 border-pink-500/40 text-pink-400"
                    : "bg-bg-card border-border text-text-secondary hover:text-pink-400 hover:border-pink-500/40"
                )}
              >
                <svg className="w-4 h-4" fill={wishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>

              {/* Save Image */}
              <button
                onClick={handleSaveImage}
                disabled={savingImage}
                title="Save image"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {saveStatus === "ok" ? (
                  <svg className="w-4 h-4 text-legal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : savingImage ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                <span className="text-xs font-medium">Save</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                disabled={sharing}
                title="Share card"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                <span className="text-xs font-medium">Share</span>
              </button>
            </div>
          </div>

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-card-name text-xl text-text-primary">{card.name}</h1>
              {manaCost && <ManaCost cost={manaCost} />}
            </div>

            <p className="text-body text-text-secondary mb-1">{typeLine}</p>

            {(card.power || card.card_faces?.[0]?.power) && (
              <p className="text-sm text-text-secondary mb-2">
                {card.power || card.card_faces?.[0]?.power}/{card.toughness || card.card_faces?.[0]?.toughness}
              </p>
            )}

            {card.loyalty && (
              <p className="text-sm text-text-secondary mb-2">Loyalty: {card.loyalty}</p>
            )}

            <div className="mb-4">
              <p className="text-sm whitespace-pre-wrap">{oracleText}</p>
            </div>

            {/* Prices */}
            <div className="mb-4">
              <CardPricesPanel card={card} />
            </div>

            {/* Set Info */}
            <p className="text-caption mb-4">
              {card.set_name} ({card.set.toUpperCase()}) &middot; #{card.collector_number} &middot;{" "}
              <span className="capitalize">{card.rarity}</span>
            </p>

            {/* Add to Deck button */}
            {deckId && (
              <button
                onClick={handleAddToDeck}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all bg-accent text-black hover:bg-accent-dark active:scale-95 shadow-[0_2px_12px_rgba(237,154,87,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
              >
                {addedFeedback ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Added!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add to Deck ({category})
                  </>
                )}
              </button>
            )}

            {/* Add to Collection button */}
            {binderId && (
              <button
                onClick={handleAddToCollection}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all bg-bg-card border border-accent/50 text-accent hover:bg-accent/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
              >
                {addedCollectionFeedback ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Added to Collection!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add to Collection
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <Tabs
            tabs={[
              { value: "versions", label: "Printings" },
              { value: "rulings", label: "Rulings" },
              { value: "combos", label: `Combos${comboState.loaded && comboState.count > 0 ? ` (${comboState.count})` : ""}` },
            ]}
            active={activeTab}
            onChange={handleTabChange}
            className="mb-4"
          />

          {activeTab === "versions" && (
            <PriceTable printings={printings} deckId={deckId} category={category} />
          )}

          {activeTab === "rulings" && (
            <div className="space-y-6">
              <LegalityTable legalities={card.legalities} />
              {rulings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">Rulings</h3>
                  <RulingsPanel rulings={rulings} />
                </div>
              )}
            </div>
          )}

          {activeTab === "combos" && (
            <CombosPanel
              cardName={card.name}
              combos={comboState.combos}
              count={comboState.count}
              loading={comboState.loading}
              error={comboState.error}
              loaded={comboState.loaded}
            />
          )}
        </div>
      </PageContainer>
    </>
  );
}

export default function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <CardDetailPageInner params={params} />
    </Suspense>
  );
}
