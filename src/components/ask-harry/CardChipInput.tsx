"use client";

import { useState, useRef } from "react";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import { cn } from "@/lib/utils/cn";

interface CardChipInputProps {
  cards: string[];
  onAdd: (name: string) => void;
  onRemove: (index: number) => void;
  maxCards?: number;
}

export default function CardChipInput({ cards, onAdd, onRemove, maxCards = 5 }: CardChipInputProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const { suggestions, loading } = useAutocomplete(query);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(name: string) {
    if (cards.length >= maxCards) return;
    if (cards.some((c) => c.toLowerCase() === name.toLowerCase())) return;
    onAdd(name);
    setQuery("");
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      {/* Chips */}
      {cards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cards.map((card, i) => (
            <span
              key={card}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-xs font-medium border border-accent/30"
            >
              {card}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-accent/30 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + Dropdown */}
      {cards.length < maxCards && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => {
              // Delay to allow click on dropdown item
              setTimeout(() => setShowDropdown(false), 200);
            }}
            placeholder="Type a card name..."
            className="input-base w-full px-3 py-2 text-sm"
          />

          {/* Autocomplete dropdown */}
          {showDropdown && query.length >= 2 && (
            <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {loading && (
                <div className="px-3 py-2 text-xs text-text-muted">Searching...</div>
              )}
              {!loading && suggestions.length === 0 && query.length >= 2 && (
                <div className="px-3 py-2 text-xs text-text-muted">No cards found</div>
              )}
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(s.name)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors",
                    cards.some((c) => c.toLowerCase() === s.name.toLowerCase()) && "opacity-40 pointer-events-none"
                  )}
                >
                  {s.name}
                  {s.typeLine && (
                    <span className="text-xs text-text-muted ml-2">{s.typeLine}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
