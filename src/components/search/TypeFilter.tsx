"use client";

import { CARD_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

interface TypeFilterProps {
  value: string;
  onChange: (type: string) => void;
}

export default function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="type-filter" className="text-xs text-text-muted">
        Type
      </label>
      <select
        id="type-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary",
          "focus:outline-none focus:border-accent transition-colors"
        )}
      >
        <option value="">All Types</option>
        {CARD_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </div>
  );
}
