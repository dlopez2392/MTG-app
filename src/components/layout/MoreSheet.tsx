"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Collection",
    items: [
      { href: "/collection", label: "Collection" },
      { href: "/wishlist", label: "Wishlist" },
      { href: "/trades", label: "Trades" },
    ],
  },
  {
    label: "Playgroup",
    items: [
      { href: "/playgroup", label: "Playgroup" },
      { href: "/games", label: "Game Log" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/ask-harry", label: "Ask Harry" },
      { href: "/brackets", label: "Brackets" },
      { href: "/rules", label: "Rulebook" },
      { href: "/decks/matchup", label: "Matchup Analysis" },
      { href: "/packages", label: "Packages" },
      { href: "/allocation", label: "Card Allocation" },
      { href: "/news", label: "News" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings" }],
  },
];

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More tools"
        className="fixed bottom-0 left-0 right-0 z-[61] animate-sheet-up rounded-t-3xl glass border-t border-border/50 max-h-[75vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-label text-text-muted mb-2">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "glass-panel rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "text-accent border-accent/40"
                          : "text-text-primary hover:border-accent/30"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
