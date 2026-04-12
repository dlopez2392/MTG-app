"use client";

import { formatPrice } from "@/lib/utils/prices";
import type { ScryfallCard } from "@/types/card";

interface Vendor {
  key: string;
  name: string;
  normal: string | null;
  foil: string | null;
  currency: string;
  buyUrl: string | null;
  note?: string;
}

function BuyButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition-colors"
    >
      {label}
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  );
}

interface CardPricesPanelProps {
  card: ScryfallCard;
}

export default function CardPricesPanel({ card }: CardPricesPanelProps) {
  const { prices, purchase_uris, name } = card;

  const ckUrl = `https://www.cardkingdom.com/catalog/search?search=header&filter[name]=${encodeURIComponent(name)}`;

  const vendors: Vendor[] = [
    {
      key: "tcgplayer",
      name: "TCGPlayer",
      normal: prices.usd,
      foil: prices.usd_foil,
      currency: "usd",
      buyUrl: purchase_uris?.tcgplayer ?? null,
    },
    {
      key: "cardkingdom",
      name: "Card Kingdom",
      normal: null,
      foil: null,
      currency: "usd",
      buyUrl: ckUrl,
      note: "Check site for price",
    },
    {
      key: "cardmarket",
      name: "Cardmarket",
      normal: prices.eur,
      foil: prices.eur_foil,
      currency: "eur",
      buyUrl: purchase_uris?.cardmarket ?? null,
    },
    ...(prices.tix
      ? [
          {
            key: "cardhoarder",
            name: "MTGO",
            normal: prices.tix,
            foil: null,
            currency: "tix",
            buyUrl: purchase_uris?.cardhoarder ?? null,
          } satisfies Vendor,
        ]
      : []),
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-bg-hover border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
        <span>Vendor</span>
        <span className="text-right">Normal</span>
        <span className="text-right">Foil</span>
        <span />
      </div>

      {/* Rows */}
      {vendors.map((v) => (
        <div
          key={v.key}
          className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 border-b border-border last:border-0 hover:bg-bg-card/50 transition-colors"
        >
          {/* Vendor name */}
          <span className="text-sm font-medium text-text-primary">{v.name}</span>

          {/* Normal price */}
          <span className="text-sm text-right font-mono tabular-nums text-text-primary min-w-[52px]">
            {v.note ? (
              <span className="text-[10px] text-text-muted italic">{v.note}</span>
            ) : (
              formatPrice(v.normal, v.currency)
            )}
          </span>

          {/* Foil price */}
          <span className="text-sm text-right font-mono tabular-nums text-text-secondary min-w-[52px]">
            {v.foil ? formatPrice(v.foil, v.currency) : <span className="text-text-muted">—</span>}
          </span>

          {/* Buy link */}
          <span className="flex justify-end">
            {v.buyUrl ? (
              <BuyButton url={v.buyUrl} label="Buy" />
            ) : (
              <span className="w-10" />
            )}
          </span>
        </div>
      ))}

      {/* Etched foil row if present */}
      {prices.usd_etched && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 border-t border-border hover:bg-bg-card/50 transition-colors">
          <span className="text-sm font-medium text-text-primary">
            TCGPlayer <span className="text-[10px] text-text-muted font-normal">Etched</span>
          </span>
          <span className="text-sm text-right font-mono tabular-nums text-text-primary min-w-[52px]">
            {formatPrice(prices.usd_etched)}
          </span>
          <span className="text-sm text-right text-text-muted min-w-[52px]">—</span>
          <span className="flex justify-end">
            {purchase_uris?.tcgplayer ? (
              <BuyButton url={purchase_uris.tcgplayer} label="Buy" />
            ) : (
              <span className="w-10" />
            )}
          </span>
        </div>
      )}

      <p className="text-[9px] text-text-muted px-3 py-1.5 border-t border-border">
        Prices via Scryfall · Updated daily
      </p>
    </div>
  );
}
