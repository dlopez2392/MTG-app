"use client";

import { cn } from "@/lib/utils/cn";

interface PoisonCounterProps {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  className?: string;
}

export default function PoisonCounter({
  count,
  onIncrement,
  onDecrement,
  className,
}: PoisonCounterProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        onClick={onDecrement}
        disabled={count <= 0}
        className="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
      >
        -
      </button>

      <div className="flex items-center gap-1.5">
        {/* Skull/Poison icon */}
        <svg
          className={cn(
            "w-5 h-5",
            count >= 10 ? "text-banned" : "text-legal"
          )}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 2a6 6 0 00-6 6c0 1.887.87 3.568 2.23 4.668A1.5 1.5 0 017 14.5V16a1 1 0 001 1h1v1a1 1 0 102 0v-1h1a1 1 0 001-1v-1.5a1.5 1.5 0 01.77-1.832A6 6 0 0010 2zM8 9a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        <span
          className={cn(
            "text-xl font-black tabular-nums",
            count >= 10 ? "text-banned" : "text-legal"
          )}
        >
          {count}
        </span>
      </div>

      <button
        onClick={onIncrement}
        className="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        +
      </button>
    </div>
  );
}
