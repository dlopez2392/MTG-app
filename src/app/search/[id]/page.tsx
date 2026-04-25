"use client";

import { Suspense } from "react";
import { useState, use, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
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
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/prices";
import type { DeckCategory } from "@/types/deck";

function CardDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { card, rulings, printings, loading, error } = useCardDetail(id);
  const { allDecks, addCardToDeck } = useDecks();
  const { allBinders, addCardToBinder } = useCollection();
  const { isOnWishlist, addItem: addToWishlist, removeItem: removeFromWishlist, items: wishlistItems } = useWishlist();
  const [activeTab, setActiveTab] = useState("versions");
  const comboState = useCardCombos(card?.name ?? "");

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === "combos") comboState.load();
  }, [comboState]);

  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "err">("idle");
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [showBinderPicker, setShowBinderPicker] = useState(false);
  const [pricingSource, setPricingSource] = useState<"tcg" | "cardmarket" | "cardhoarder">("tcg");

  const deckId = searchParams.get("deckId");
  const category = (searchParams.get("category") ?? "main") as DeckCategory;
  const binderId = searchParams.get("binderId");

  const handleAddToDeck = useCallback(async (targetDeckId: string) => {
    if (!card) return;
    await addCardToDeck(targetDeckId, card, "main");
    setShowDeckPicker(false);
    setMenuOpen(false);
    setAddedFeedback("Added to deck!");
    setTimeout(() => setAddedFeedback(null), 2000);
  }, [card, addCardToDeck]);

  const handleAddToCollection = useCallback(async (targetBinderId: string) => {
    if (!card) return;
    const imageUri = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
    try {
      await addCardToBinder(targetBinderId, {
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
      setShowBinderPicker(false);
      setMenuOpen(false);
      setAddedFeedback("Added to collection!");
      setTimeout(() => setAddedFeedback(null), 2000);
    } catch {
      // silent
    }
  }, [card, addCardToBinder]);

  // Direct add when coming from deck/binder context
  const handleAddToDeckDirect = useCallback(async () => {
    if (!card || !deckId) return;
    await addCardToDeck(deckId, card, category);
    setAddedFeedback("Added to deck!");
    setTimeout(() => setAddedFeedback(null), 2000);
  }, [card, deckId, category, addCardToDeck]);

  const handleAddToCollectionDirect = useCallback(async () => {
    if (!card || !binderId) return;
    const imageUri = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
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
    setAddedFeedback("Added to collection!");
    setTimeout(() => setAddedFeedback(null), 2000);
  }, [card, binderId, addCardToBinder]);

  const handleSaveImage = useCallback(async () => {
    const imageUrl =
      card?.image_uris?.normal ??
      card?.card_faces?.[0]?.image_uris?.normal;
    if (!imageUrl || savingImage) return;
    setSavingImage(true);
    setMenuOpen(false);
    try {
      const proxyUrl = `/api/scryfall/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const filename = `${card!.name.replace(/[^a-z0-9]/gi, "_")}.jpg`;
      const file = new File([blob], filename, { type: "image/jpeg" });
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        if (navigator.share) {
          await navigator.share({ files: [file], title: card!.name });
        } else {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          URL.revokeObjectURL(url);
        }
      } else {
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
    setMenuOpen(false);
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
        setAddedFeedback("Link copied!");
        setTimeout(() => setAddedFeedback(null), 2000);
      }
    } catch {
      // user dismissed
    } finally {
      setSharing(false);
    }
  }, [card, sharing]);

  const [lightboxOpen, setLightboxOpen] = useState(false);

  const wishlisted = card ? isOnWishlist(card.id) : false;
  const wishlistId = card ? wishlistItems.find((i) => i.scryfallId === card.id)?.id : undefined;

  const handleToggleWishlist = useCallback(() => {
    if (!card) return;
    setMenuOpen(false);
    if (wishlisted && wishlistId) {
      removeFromWishlist(wishlistId);
      setAddedFeedback("Removed from wishlist");
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
      setAddedFeedback("Added to wishlist!");
    }
    setTimeout(() => setAddedFeedback(null), 2000);
  }, [card, wishlisted, wishlistId, addToWishlist, removeFromWishlist]);

  if (loading) {
    return (
      <div className="pb-20">
        <Skeleton className="w-full aspect-[4/3]" />
        <div className="px-4 pt-4 space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="px-4 pt-12 pb-20">
        <button
          onClick={() => router.back()}
          className="mb-4 w-8 h-8 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))",
            boxShadow: "0 2px 8px rgba(124,92,252,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-banned">{error || "Card not found"}</p>
      </div>
    );
  }

  const oracleText = card.oracle_text || card.card_faces?.[0]?.oracle_text || "";
  const typeLine = card.type_line;
  const manaCost = card.mana_cost || card.card_faces?.[0]?.mana_cost || "";
  const artCrop = card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop;
  const hasStats = card.power != null && card.toughness != null;
  const price = card.prices;

  return (
    <div className="pb-20 animate-page-enter">
      {/* ── Large Art Crop ── */}
      <div className="relative">
        {artCrop ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className="block w-full cursor-zoom-in"
          >
            <Image
              src={artCrop}
              alt={card.name}
              width={626}
              height={457}
              className="w-full aspect-[4/3] object-cover"
              priority
            />
          </button>
        ) : (
          <div className="w-full aspect-[4/3] bg-bg-secondary flex items-center justify-center text-text-muted">
            No artwork
          </div>
        )}

        {/* Back button overlay */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all z-10"
          style={{
            background: "linear-gradient(135deg, rgba(124,92,252,0.5), rgba(124,92,252,0.2))",
            boxShadow: "0 2px 10px rgba(124,92,252,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
            backdropFilter: "blur(8px)",
          }}
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* ── Card Info ── */}
      <div className="px-4 pt-4">
        {/* Name + Mana + P/T */}
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h1 className="text-xl font-bold text-text-primary leading-tight">{card.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {manaCost && <ManaCost cost={manaCost} />}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">{typeLine}</p>
          {hasStats && (
            <span className="text-lg font-bold text-text-primary">{card.power}/{card.toughness}</span>
          )}
          {card.loyalty && (
            <span className="text-lg font-bold text-text-primary">Loyalty: {card.loyalty}</span>
          )}
        </div>

        {/* Oracle Text */}
        {oracleText && (
          <div className="mt-3 bg-bg-card border border-border rounded-xl p-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-text-primary">{oracleText}</p>
          </div>
        )}

        {/* ── Pricing Section ── */}
        <div className="mt-5">
          <div className="bg-bg-card border border-border rounded-2xl">
            {/* Header: source toggle */}
            <div className="px-4 py-2.5 border-b border-border">
              <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-border">
                {(["tcg", "cardmarket", "cardhoarder"] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => setPricingSource(src)}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all text-center",
                      pricingSource === src ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                    )}
                  >
                    {src === "tcg" ? "TCGplayer" : src === "cardmarket" ? "Cardmarket" : "Cardhoarder"}
                  </button>
                ))}
              </div>
            </div>

            {/* Price chips */}
            <div className="px-4 py-3">
              {pricingSource === "tcg" && (
                <div className={cn("grid gap-2", price.usd_etched ? "grid-cols-3" : "grid-cols-2")}>
                  <div className="bg-emerald-500/10 rounded-xl py-3 px-2 text-center">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-1">Normal</p>
                    <p className="text-lg font-bold text-text-primary tabular-nums">{price.usd ? formatPrice(price.usd) : "—"}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl py-3 px-2 text-center">
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-1">Foil</p>
                    <p className="text-lg font-bold text-text-primary tabular-nums">{price.usd_foil ? formatPrice(price.usd_foil) : "—"}</p>
                  </div>
                  {price.usd_etched && (
                    <div className="bg-amber-500/10 rounded-xl py-3 px-2 text-center">
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1">Etched</p>
                      <p className="text-lg font-bold text-text-primary tabular-nums">{formatPrice(price.usd_etched)}</p>
                    </div>
                  )}
                </div>
              )}
              {pricingSource === "cardmarket" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-500/10 rounded-xl py-3 px-2 text-center">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Normal</p>
                    <p className="text-lg font-bold text-text-primary tabular-nums">{price.eur ? formatPrice(price.eur, "eur") : "—"}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl py-3 px-2 text-center">
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-1">Foil</p>
                    <p className="text-lg font-bold text-text-primary tabular-nums">{price.eur_foil ? formatPrice(price.eur_foil, "eur") : "—"}</p>
                  </div>
                </div>
              )}
              {pricingSource === "cardhoarder" && (
                <div className="grid grid-cols-1 gap-2">
                  <div className="bg-cyan-500/10 rounded-xl py-3 px-2 text-center">
                    <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide mb-1">MTGO Tix</p>
                    <p className="text-lg font-bold text-text-primary tabular-nums">{price.tix ? `${price.tix} tix` : "—"}</p>
                  </div>
                </div>
              )}

              {/* Set info */}
              <p className="text-[10px] text-text-muted mt-2.5">
                {card.set_name} ({card.set.toUpperCase()}) · #{card.collector_number} · <span className="capitalize">{card.rarity}</span>
              </p>
            </div>

            {/* Action buttons row */}
            <div className="flex gap-2 px-4 pb-3">
              {pricingSource === "tcg" && card.purchase_uris?.tcgplayer && (
                <a
                  href={card.purchase_uris.tcgplayer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl btn-gradient text-xs font-bold active:scale-[0.98] transition-all"
                >
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  <span className="text-black">Buy on TCGplayer</span>
                </a>
              )}
              {pricingSource === "cardmarket" && card.purchase_uris?.cardmarket && (
                <a
                  href={card.purchase_uris.cardmarket}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl btn-gradient text-xs font-bold active:scale-[0.98] transition-all"
                >
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  <span className="text-black">Buy on Cardmarket</span>
                </a>
              )}
              {pricingSource === "cardhoarder" && card.purchase_uris?.cardhoarder && (
                <a
                  href={card.purchase_uris.cardhoarder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl btn-gradient text-xs font-bold active:scale-[0.98] transition-all"
                >
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  <span className="text-black">Buy on Cardhoarder</span>
                </a>
              )}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="h-full px-4 py-2.5 rounded-xl btn-gradient flex items-center justify-center active:scale-90 transition-all"
                >
                  <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                  </svg>
                </button>

                {/* Action menu */}
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setShowDeckPicker(false); setShowBinderPicker(false); }} />
                    <div className="absolute right-0 bottom-14 z-50 bg-bg-secondary border border-border rounded-xl shadow-2xl p-1.5 min-w-[200px]">
                      {/* Share */}
                      <button
                        onClick={handleShare}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        Share Card
                      </button>

                      {/* Add to Deck */}
                      {deckId ? (
                        <button
                          onClick={handleAddToDeckDirect}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Add to Deck
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowDeckPicker(!showDeckPicker); setShowBinderPicker(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Add to Deck
                          <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      )}
                      {showDeckPicker && !deckId && (
                        <div className="ml-4 border-l border-border pl-2 py-1 max-h-40 overflow-y-auto">
                          {allDecks.length === 0 ? (
                            <p className="text-xs text-text-muted px-2 py-1">No decks yet</p>
                          ) : allDecks.map((d) => (
                            <button
                              key={d.id}
                              onClick={() => handleAddToDeck(d.id!)}
                              className="w-full text-left px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors truncate"
                            >
                              {d.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Add to Collection */}
                      {binderId ? (
                        <button
                          onClick={handleAddToCollectionDirect}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                          </svg>
                          Add to Collection
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowBinderPicker(!showBinderPicker); setShowDeckPicker(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                          </svg>
                          Add to Collection
                          <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      )}
                      {showBinderPicker && !binderId && (
                        <div className="ml-4 border-l border-border pl-2 py-1 max-h-40 overflow-y-auto">
                          {allBinders.length === 0 ? (
                            <p className="text-xs text-text-muted px-2 py-1">No binders yet</p>
                          ) : allBinders.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => handleAddToCollection(b.id!)}
                              className="w-full text-left px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors truncate"
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-border my-1" />

                      {/* Save Image */}
                      <button
                        onClick={handleSaveImage}
                        disabled={savingImage}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Save Image
                      </button>

                      {/* Wishlist */}
                      <button
                        onClick={handleToggleWishlist}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill={wishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                        {wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-5">
          <Tabs
            tabs={[
              { value: "versions", label: "Versions" },
              { value: "rulings", label: "Ruling" },
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
      </div>

      {/* Feedback toast */}
      {addedFeedback && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-legal/90 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-sm animate-page-enter">
          {addedFeedback}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <CardImage card={card} size="large" />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <CardDetailPageInner params={params} />
    </Suspense>
  );
}
