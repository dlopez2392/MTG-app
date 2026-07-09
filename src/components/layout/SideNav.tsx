"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const SECTIONS: { label: string | null; items: { href: string; label: string; exact?: boolean }[] }[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Home", exact: true },
      { href: "/search", label: "Search" },
      { href: "/decks", label: "Decks" },
      { href: "/life", label: "Life Counter" },
    ],
  },
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
      { href: "/settings", label: "Settings" },
    ],
  },
];

export default function SideNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    // Avoid "/decks" highlighting for "/decks/matchup"
    if (href === "/decks" && pathname.startsWith("/decks/matchup")) return false;
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-56 flex-col glass border-r border-border/50 overflow-y-auto">
      <Link href="/" className="px-5 pt-6 pb-4">
        <span className="font-mtg text-mtg-gradient text-xl font-bold">MTG Houdini</span>
      </Link>
      <nav className="flex-1 px-3 pb-6">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mb-4">
            {section.label && (
              <p className="text-label text-text-muted px-2 mb-1.5">{section.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover/60"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
