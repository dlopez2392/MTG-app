"use client";

import { useState, use } from "react";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import CardImage from "@/components/cards/CardImage";
import ManaCost from "@/components/cards/ManaCost";
import LegalityTable from "@/components/cards/LegalityTable";
import PriceTable from "@/components/cards/PriceTable";
import RulingsPanel from "@/components/cards/RulingsPanel";
import Tabs from "@/components/ui/Tabs";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { useCardDetail } from "@/hooks/useCardDetail";
import { formatPrice } from "@/lib/utils/prices";

export default function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { card, rulings, printings, loading, error } = useCardDetail(id);
  const [activeTab, setActiveTab] = useState("versions");

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
          {/* Card Image */}
          <div className="flex-shrink-0 sm:w-64">
            <CardImage card={card} size="normal" />
          </div>

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-xl font-bold">{card.name}</h1>
              {manaCost && <ManaCost cost={manaCost} />}
            </div>

            <p className="text-text-secondary text-sm mb-1">{typeLine}</p>

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
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge>{formatPrice(card.prices.usd)} USD</Badge>
              {card.prices.usd_foil && (
                <Badge>{formatPrice(card.prices.usd_foil)} Foil</Badge>
              )}
              {card.prices.eur && (
                <Badge>{formatPrice(card.prices.eur, "eur")} EUR</Badge>
              )}
            </div>

            {/* Set Info */}
            <p className="text-xs text-text-muted mb-4">
              {card.set_name} ({card.set.toUpperCase()}) &middot; #{card.collector_number} &middot;{" "}
              <span className="capitalize">{card.rarity}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <Tabs
            tabs={[
              { value: "versions", label: "Printings" },
              { value: "rulings", label: "Ruling" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
            className="mb-4"
          />

          {activeTab === "versions" && (
            <PriceTable printings={printings} />
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
        </div>
      </PageContainer>
    </>
  );
}
