"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import HeroBanner from "@/components/layout/HeroBanner";
import EmptyState from "@/components/ui/EmptyState";
import { useWishlist } from "@/hooks/useWishlist";
import { formatPrice } from "@/lib/utils/prices";
import { cn } from "@/lib/utils/cn";
import type { WishlistItem } from "@/types/wishlist";

// ── Price status helpers ──────────────────────────────────────────────────────
function getPriceStatus(current: string | undefined, target: number | undefined) {
  if (!target || !current) return "none";
  const cur = parseFloat(current);
  if (isNaN(cur)) return "none";
  if (cur <= target) return "met";       // at or below target — green
  if (cur <= target * 1.2) return "close"; // within 20% — yellow
  return "above";                          // more than 20% above — normal
}

function PriceStatusDot({ status }: { status: string }) {
  if (status === "none") return null;
  return (
    <span className={cn(
      "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
      status === "met"   ? "bg-legal"       :
      status === "close" ? "bg-restricted"  :
                           "bg-text-muted"
    )} />
  );
}

// ── Single item row ───────────────────────────────────────────────────────────
function WishlistRow({
  item,
  onRemove,
  onSetTarget,
  onClick,
}: {
  item: WishlistItem;
  onRemove: (id: string) => void;
  onSetTarget: (id: string, price: number | undefined) => void;
  onClick: (scryfallId: string) => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState(item.targetPrice?.toString() ?? "");

  const priceStatus = getPriceStatus(item.priceUsd, item.targetPrice);

  function commitPrice() {
    const val = parseFloat(draftPrice);
    onSetTarget(item.id, isNaN(val) || draftPrice.trim() === "" ? undefined : val);
    setEditingPrice(false);
  }

  function handlePriceKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === "Escape") commitPrice();
  }

  return (
    <div className="flex items-center gap-3 glass-card border border-border rounded-xl px-3 py-2.5 hover:border-border/70 transition-colors">
      {/* Card thumb */}
      <button
        onClick={() => onClick(item.scryfallId)}
        className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
      >
        {item.imageUri ? (
          <Image
            src={item.imageUri}
            alt={item.name}
            width={30}
            height={42}
            className="rounded-sm"
          />
        ) : (
          <div className="w-[30px] h-[42px] rounded-sm bg-bg-secondary flex items-center justify-center text-[8px] text-text-muted">?</div>
        )}
      </button>

      {/* Name / type */}
      <button
        onClick={() => onClick(item.scryfallId)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
      >
        <span className="block truncate text-sm font-medium text-text-primary leading-snug">
          {item.name}
        </span>
        {item.typeLine && (
          <span className="block truncate text-xs text-text-secondary mt-0.5">
            {item.typeLine}
          </span>
        )}
      </button>

      {/* Prices column */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {/* Current price */}
        <span className="text-xs font-semibold text-accent tabular-nums">
          {item.priceUsd ? formatPrice(item.priceUsd) : "—"}
        </span>

        {/* Target price — tap to edit */}
        {editingPrice ? (
          <input
            autoFocus
            type="number"
            min="0"
            step="0.01"
            value={draftPrice}
            onChange={(e) => setDraftPrice(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={handlePriceKeyDown}
            placeholder="0.00"
            className="w-16 text-xs text-right bg-bg-secondary border border-accent/50 rounded px-1 py-0.5 outline-none tabular-nums"
          />
        ) : (
          <button
            onClick={() => { setDraftPrice(item.targetPrice?.toString() ?? ""); setEditingPrice(true); }}
            className={cn(
              "flex items-center gap-1 text-[10px] tabular-nums transition-colors",
              item.targetPrice
                ? priceStatus === "met"   ? "text-legal"
                : priceStatus === "close" ? "text-restricted"
                : "text-text-muted"
                : "text-text-muted/60 italic"
            )}
            title="Set price target"
          >
            <PriceStatusDot status={priceStatus} />
            {item.targetPrice ? `≤ ${formatPrice(item.targetPrice.toString())}` : "set target"}
          </button>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        className="flex-shrink-0 p-1.5 text-text-muted hover:text-banned transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banned rounded"
        title="Remove from wishlist"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function WishlistPage() {
  const router = useRouter();
  const { items, removeItem, updateTargetPrice } = useWishlist();

  const handleCardClick = useCallback((scryfallId: string) => {
    router.push(`/search/${scryfallId}`);
  }, [router]);

  const metCount = items.filter((i) =>
    getPriceStatus(i.priceUsd, i.targetPrice) === "met"
  ).length;

  const totalValue = items.reduce((sum, i) => {
    const p = parseFloat(i.priceUsd ?? "0");
    return sum + (isNaN(p) ? 0 : p);
  }, 0);

  const handleShare = useCallback(async () => {
    if (items.length === 0) return;
    const lines = items.map((item) => {
      const price = item.priceUsd ? ` - ${formatPrice(item.priceUsd)}` : "";
      const target = item.targetPrice ? ` (target: ≤${formatPrice(item.targetPrice.toString())})` : "";
      return `• ${item.name}${price}${target}`;
    });
    const text = `MTG Wishlist (${items.length} card${items.length !== 1 ? "s" : ""}, est. ${formatPrice(totalValue.toFixed(2))})\n\n${lines.join("\n")}`;

    if (navigator.share) {
      await navigator.share({ title: "My MTG Wishlist", text }).catch(() => {});
    } else {
      const smsBody = encodeURIComponent(text);
      window.open(`sms:?body=${smsBody}`, "_blank");
    }
  }, [items, totalValue]);

  const HEART_ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Wishlist"
        subtitle={
          items.length > 0
            ? `${items.length} card${items.length !== 1 ? "s" : ""} · est. ${formatPrice(totalValue.toFixed(2))}`
            : "Cards you want to acquire"
        }
        accent="#EC4899"
        icon={HEART_ICON}
        onBack={() => router.back()}
      />

      <PageContainer>
        {items.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            }
            title="Your wishlist is empty"
            description="Browse cards and tap the heart icon to save them here. Set a target price to track when they drop."
          />
        ) : (
          <>
            {/* Stats bar */}
            {metCount > 0 && (
              <div className="mb-4 flex items-center gap-2 bg-legal/10 border border-legal/20 rounded-xl px-4 py-2.5">
                <svg className="w-4 h-4 text-legal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-legal font-medium">
                  {metCount} card{metCount !== 1 ? "s are" : " is"} at or below your target price!
                </span>
              </div>
            )}

            {/* Actions bar */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-text-muted">
                Tap a card to view · Tap "set target" for price alerts
              </p>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 active:scale-95 transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Share
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <WishlistRow
                  key={item.id}
                  item={item}
                  onRemove={removeItem}
                  onSetTarget={updateTargetPrice}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}
