"use client";

import { useRef, useState } from "react";
import Input from "@/components/ui/Input";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import { cn } from "@/lib/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSelect?: (name: string) => void;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onSelect,
}: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const { suggestions } = useAutocomplete(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      onSubmit();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleSelect = (name: string) => {
    setOpen(false);
    onChange(name);
    onSelect?.(name);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay close so click on suggestion registers
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search cards..."
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
        }
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-card shadow-lg">
          {suggestions.map((name) => (
            <li
              key={name}
              onMouseDown={() => handleSelect(name)}
              className={cn(
                "cursor-pointer px-4 py-2 text-sm text-text-primary",
                "hover:bg-bg-secondary transition-colors"
              )}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
