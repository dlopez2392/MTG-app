"use client";

import Badge from "@/components/ui/Badge";
import type { Legality } from "@/types/card";

interface LegalityTableProps {
  legalities: Record<string, Legality>;
}

const FORMATS: { key: string; label: string }[] = [
  { key: "standard", label: "Standard" },
  { key: "pioneer", label: "Pioneer" },
  { key: "modern", label: "Modern" },
  { key: "legacy", label: "Legacy" },
  { key: "vintage", label: "Vintage" },
  { key: "commander", label: "Commander" },
  { key: "brawl", label: "Brawl" },
  { key: "historic", label: "Historic" },
  { key: "explorer", label: "Explorer" },
  { key: "pauper", label: "Pauper" },
  { key: "penny", label: "Penny" },
  { key: "alchemy", label: "Alchemy" },
  { key: "timeless", label: "Timeless" },
  { key: "oathbreaker", label: "Oathbreaker" },
];

const LEGALITY_LABELS: Record<string, string> = {
  legal: "Legal",
  not_legal: "Not Legal",
  banned: "Banned",
  restricted: "Restricted",
};

export default function LegalityTable({ legalities }: LegalityTableProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FORMATS.map(({ key, label }) => {
        const status = legalities[key] ?? "not_legal";
        return (
          <div
            key={key}
            className="flex items-center justify-between rounded-md bg-bg-card px-3 py-2"
          >
            <span className="text-sm text-text-secondary">{label}</span>
            <Badge variant={status as Legality}>
              {LEGALITY_LABELS[status] ?? status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
