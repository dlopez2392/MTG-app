"use client";

import { cn } from "@/lib/utils/cn";

interface ViewToggleProps {
  view: "grid" | "list";
  onChange: (view: "grid" | "list") => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-bg-card">
      {/* Grid icon */}
      <button
        type="button"
        onClick={() => onChange("grid")}
        title="Grid view"
        className={cn(
          "flex items-center justify-center rounded-l-lg p-2 transition-colors",
          view === "grid"
            ? "bg-accent/20 text-accent"
            : "text-text-muted hover:text-text-primary"
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>

      {/* List icon */}
      <button
        type="button"
        onClick={() => onChange("list")}
        title="List view"
        className={cn(
          "flex items-center justify-center rounded-r-lg p-2 transition-colors",
          view === "list"
            ? "bg-accent/20 text-accent"
            : "text-text-muted hover:text-text-primary"
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
