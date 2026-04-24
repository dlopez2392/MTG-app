"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils/prices";
import { cn } from "@/lib/utils/cn";
import type { ScryfallCard } from "@/types/card";

interface CardPricesPanelProps {
  card: ScryfallCard;
}

export default function CardPricesPanel({ card }: CardPricesPanelProps) {
  const { prices, purchase_uris, name } = card;
  const [source, setSource] = useState<"tcg" | "cardmarket" | "cardhoarder">("tcg");

  const cmUrl = purchase_uris?.cardmarket ?? `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(name)}`;

  const sources = [
    { key: "tcg" as const, label: "TCGplayer" },
    { key: "cardmarket" as const, label: "Cardmarket" },
    { key: "cardhoarder" as const, label: "Cardhoarder" },
  ];

  const buyUrl =
    source === "tcg" ? (purchase_uris?.tcgplayer ?? null) :
    source === "cardmarket" ? cmUrl :
    (purchase_uris?.cardhoarder ?? null);

  const buyLabel =
    source === "tcg" ? "TCGplayer" :
    source === "cardmarket" ? "Cardmarket" : "Cardhoarder";

  return (
    <div className="rounded-2xl border border-border overflow-hidden glass-card">
      {/* Source toggle */}
      <div className="px-3 py-2 bg-bg-hover border-b border-border">
        <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-border">
          {sources.map((s) => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={cn(
                "flex-1 py-1 rounded-md text-[10px] font-semibold transition-all text-center",
                source === s.key ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price chips */}
      <div className="px-3 py-3">
        {source === "tcg" && (
          <div className={cn("grid gap-2", prices.usd_etched ? "grid-cols-3" : "grid-cols-2")}>
            <div className="bg-emerald-500/10 rounded-xl py-2.5 px-2 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-0.5">Normal</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">{prices.usd ? formatPrice(prices.usd) : "—"}</p>
            </div>
            <div className="bg-purple-500/10 rounded-xl py-2.5 px-2 text-center">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-0.5">Foil</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">{prices.usd_foil ? formatPrice(prices.usd_foil) : "—"}</p>
            </div>
            {prices.usd_etched && (
              <div className="bg-amber-500/10 rounded-xl py-2.5 px-2 text-center">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-0.5">Etched</p>
                <p className="text-sm font-bold text-text-primary tabular-nums">{formatPrice(prices.usd_etched)}</p>
              </div>
            )}
          </div>
        )}
        {source === "cardmarket" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-500/10 rounded-xl py-2.5 px-2 text-center">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">Normal</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">{prices.eur ? formatPrice(prices.eur, "eur") : "—"}</p>
            </div>
            <div className="bg-purple-500/10 rounded-xl py-2.5 px-2 text-center">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-0.5">Foil</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">{prices.eur_foil ? formatPrice(prices.eur_foil, "eur") : "—"}</p>
            </div>
          </div>
        )}
        {source === "cardhoarder" && (
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-cyan-500/10 rounded-xl py-2.5 px-2 text-center">
              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide mb-0.5">MTGO Tix</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">{prices.tix ? `${prices.tix} tix` : "—"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Buy link */}
      {buyUrl && (
        <div className="px-3 pb-3">
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 rounded-xl btn-gradient text-xs font-bold active:scale-[0.98] transition-all"
          >
            <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            <span className="text-black">Buy on {buyLabel}</span>
          </a>
        </div>
      )}

      <p className="text-caption px-3 py-1.5 border-t border-border">
        Prices via Scryfall · Updated daily
      </p>
    </div>
  );
}
