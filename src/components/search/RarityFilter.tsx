"use client";

import { RARITIES } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

interface RarityFilterProps {
  selected: string;
  onChange: (rarity: string) => void;
}

export default function RarityFilter({
  selected,
  onChange,
}: RarityFilterProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-muted">Rarity</span>
      <div className="flex flex-wrap gap-1.5">
        {RARITIES.map(({ value, label, color }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(isSelected ? "" : value)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-all",
                isSelected
                  ? "border-accent bg-bg-secondary"
                  : "border-border bg-bg-card hover:bg-bg-secondary"
              )}
              style={{
                color: isSelected ? color : undefined,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
