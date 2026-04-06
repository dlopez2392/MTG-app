"use client";

import { useState } from "react";
import type { SearchFilters } from "@/types/card";
import { cn } from "@/lib/utils/cn";
import ColorFilter from "./ColorFilter";
import RarityFilter from "./RarityFilter";
import TypeFilter from "./TypeFilter";
import FormatFilter from "./FormatFilter";

interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  className?: string;
}

export default function SearchFiltersPanel({
  filters,
  onChange,
  className,
}: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const update = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        Filters
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            "h-4 w-4 transition-transform",
            expanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 rounded-lg border border-border bg-bg-secondary p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <ColorFilter
                selected={filters.colors}
                onChange={(colors) => update("colors", colors)}
              />
            </div>

            <RarityFilter
              selected={filters.rarity}
              onChange={(rarity) =>
                update("rarity", rarity as SearchFilters["rarity"])
              }
            />

            <TypeFilter
              value={filters.type}
              onChange={(type) => update("type", type)}
            />

            <FormatFilter
              value={filters.format}
              onChange={(format) =>
                update("format", format as SearchFilters["format"])
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
