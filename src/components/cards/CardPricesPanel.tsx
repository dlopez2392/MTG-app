"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils/prices";
import type { ScryfallCard } from "@/types/card";

interface MtgjsonPrices {
  cardKingdom: { retail: string | null; buylist: string | null; retailFoil: string | null; buylistFoil: string | null };
  cardmarket: { retail: string | null; retailFoil: string | null };
}

interface Vendor {
  key: string;
  name: string;
  normal: string | null;
  foil: string | null;
  currency: string;
  buyUrl: string | null;
  note?: string;
  tag?: string;
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
  const { prices, purchase_uris, name, set, id } = card;
  const [mtgjson, setMtgjson] = useState<MtgjsonPrices | null>(null);
  const [mtgjsonLoading, setMtgjsonLoading] = useState(true);

  useEffect(() => {
    setMtgjsonLoading(true);
    fetch(`/api/mtgjson/prices?set=${encodeURIComponent(set)}&scryfallId=${encodeURIComponent(id)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setMtgjson(d ?? null))
      .catch(() => setMtgjson(null))
      .finally(() => setMtgjsonLoading(false));
  }, [id, set]);

  const ckUrl = `https://www.cardkingdom.com/catalog/search?search=header&filter[name]=${encodeURIComponent(name)}`;
  const cmUrl = purchase_uris?.cardmarket ?? `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(name)}`;

  const scryfallVendors: Vendor[] = [
    {
      key: "tcgplayer",
      name: "TCGPlayer",
      normal: prices.usd,
      foil: prices.usd_foil,
      currency: "usd",
      buyUrl: purchase_uris?.tcgplayer ?? null,
    },
    ...(prices.tix
      ? [{
          key: "cardhoarder",
          name: "MTGO",
          normal: prices.tix,
          foil: null,
          currency: "tix",
          buyUrl: purchase_uris?.cardhoarder ?? null,
        } satisfies Vendor]
      : []),
  ];

  const mtgjsonVendors: Vendor[] = mtgjson
    ? [
        {
          key: "ck-retail",
          name: "Card Kingdom",
          tag: "Retail",
          normal: mtgjson.cardKingdom.retail,
          foil: mtgjson.cardKingdom.retailFoil,
          currency: "usd",
          buyUrl: ckUrl,
        },
        {
          key: "ck-buylist",
          name: "Card Kingdom",
          tag: "Buylist",
          normal: mtgjson.cardKingdom.buylist,
          foil: mtgjson.cardKingdom.buylistFoil,
          currency: "usd",
          buyUrl: "https://www.cardkingdom.com/purchasing/mtg_singles",
        },
        {
          key: "cardmarket",
          name: "Cardmarket",
          normal: mtgjson.cardmarket.retail ?? prices.eur,
          foil: mtgjson.cardmarket.retailFoil ?? prices.eur_foil,
          currency: "eur",
          buyUrl: cmUrl,
        },
      ]
    : [
        {
          key: "cardkingdom-placeholder",
          name: "Card Kingdom",
          normal: null,
          foil: null,
          currency: "usd",
          buyUrl: ckUrl,
          note: "Check site for price",
        },
        {
          key: "cardmarket-placeholder",
          name: "Cardmarket",
          normal: prices.eur,
          foil: prices.eur_foil,
          currency: "eur",
          buyUrl: cmUrl,
        },
      ];

  const allVendors = [...scryfallVendors, ...mtgjsonVendors];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-bg-hover border-b border-border text-label text-text-muted">
        <span>Vendor</span>
        <span className="text-right">Normal</span>
        <span className="text-right">Foil</span>
        <span />
      </div>

      {/* Rows */}
      {allVendors.map((v) => (
        <div
          key={v.key}
          className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 border-b border-border last:border-0 hover:bg-bg-card/50 transition-colors"
        >
          <span className="text-sm font-medium text-text-primary flex items-center gap-1.5">
            {v.name}
            {v.tag && (
              <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-bg-hover text-text-muted border border-border">
                {v.tag}
              </span>
            )}
            {mtgjsonLoading && (v.key === "ck-retail" || v.key === "ck-buylist" || v.key === "cardmarket") && (
              <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            )}
          </span>

          <span className="text-sm text-right font-mono tabular-nums text-text-primary min-w-[52px]">
            {v.note ? (
              <span className="text-[10px] text-text-muted italic">{v.note}</span>
            ) : mtgjsonLoading && (v.key.startsWith("ck") || v.key === "cardmarket") ? (
              <span className="text-text-muted">···</span>
            ) : (
              formatPrice(v.normal, v.currency)
            )}
          </span>

          <span className="text-sm text-right font-mono tabular-nums text-text-secondary min-w-[52px]">
            {mtgjsonLoading && (v.key.startsWith("ck") || v.key === "cardmarket") ? (
              <span className="text-text-muted">···</span>
            ) : v.foil ? (
              formatPrice(v.foil, v.currency)
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </span>

          <span className="flex justify-end">
            {v.buyUrl ? (
              <BuyButton url={v.buyUrl} label={v.tag === "Buylist" ? "Sell" : "Buy"} />
            ) : (
              <span className="w-10" />
            )}
          </span>
        </div>
      ))}

      {/* Etched foil */}
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

      <p className="text-caption px-3 py-1.5 border-t border-border">
        Scryfall · MTGJSON · Updated daily
      </p>
    </div>
  );
}
