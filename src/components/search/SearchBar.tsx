"use client";

import { useRef, useState, useCallback } from "react";
import Input from "@/components/ui/Input";
import ManaCost from "@/components/cards/ManaCost";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import { cn } from "@/lib/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSelect?: (name: string) => void;
}

export default function SearchBar({ value, onChange, onSubmit, onSelect }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const { suggestions, loading } = useAutocomplete(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = open && (suggestions.length > 0 || loading);

  const handleSelect = useCallback(
    (name: string) => {
      setOpen(false);
      setHighlighted(-1);
      onChange(name);
      onSelect?.(name);
    },
    [onChange, onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && suggestions[highlighted]) {
        handleSelect(suggestions[highlighted].name);
      } else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Search cards..."
        icon={
          loading ? (
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          )
        }
      />

      {isOpen && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-bg-card shadow-2xl">
          {loading && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-text-muted">Searching…</li>
          )}
          {suggestions.map((card, i) => (
            <li
              key={card.id}
              onMouseDown={() => handleSelect(card.name)}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                i === highlighted ? "bg-bg-hover" : "hover:bg-bg-secondary",
                i !== 0 && "border-t border-border/50"
              )}
            >
              {/* Card thumbnail */}
              <div className="w-8 h-11 flex-shrink-0 rounded overflow-hidden bg-bg-hover">
                {card.imageUri ? (
                  <img
                    src={card.imageUri}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{card.name}</p>
                {card.typeLine && (
                  <p className="text-xs text-text-muted truncate">{card.typeLine}</p>
                )}
              </div>

              {/* Mana cost */}
              {card.manaCost && (
                <div className="flex-shrink-0">
                  <ManaCost cost={card.manaCost} className="scale-75 origin-right" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
