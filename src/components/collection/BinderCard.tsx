"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface BinderCardProps {
  id: number;
  name: string;
  cardCount: number;
  totalValue: number;
  coverImageUri?: string;
  className?: string;
}

export default function BinderCard({
  id,
  name,
  cardCount,
  totalValue,
  coverImageUri,
  className,
}: BinderCardProps) {
  return (
    <Link
      href={`/collection/${id}`}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-bg-card aspect-[3/4] flex flex-col justify-end group transition-transform active:scale-[0.97]",
        className
      )}
    >
      {/* Background image */}
      {coverImageUri ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-50 transition-opacity"
          style={{ backgroundImage: `url(${coverImageUri})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-bg-hover/50 to-bg-card" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-3">
        <h3 className="text-sm font-semibold text-text-primary truncate">
          {name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-text-muted">
            {cardCount} {cardCount === 1 ? "card" : "cards"}
          </span>
          <span className="text-xs text-accent font-medium">
            ${totalValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Top-right icon */}
      <div className="absolute top-2 right-2 z-10">
        <svg
          className="w-5 h-5 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
      </div>
    </Link>
  );
}
