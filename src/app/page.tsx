"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface HeroCard {
  name: string;
  artist?: string;
  image_uris?: { art_crop?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string } }>;
}

const FEATURES = [
  {
    href: "/decks",
    title: "DECKS",
    description: "Build & manage your decks",
    accent: "#3B82F6",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/collection",
    title: "COLLECTION",
    description: "Track your card collection",
    accent: "#22C55E",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    href: "/life",
    title: "LIFE COUNTER",
    description: "Track game life totals",
    accent: "#EF4444",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    href: "/scan",
    title: "SCAN CARD",
    description: "Identify cards with your camera",
    accent: "#A855F7",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const router = useRouter();
  const [heroCard, setHeroCard] = useState<HeroCard | null>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("https://api.scryfall.com/cards/random?q=type%3Alegendary")
      .then((r) => r.json())
      .then((card: HeroCard) => setHeroCard(card))
      .catch(() => {});
  }, []);

  const heroArt =
    heroCard?.image_uris?.art_crop ??
    heroCard?.card_faces?.[0]?.image_uris?.art_crop;

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    },
    [searchQuery, router]
  );

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 300 }}>
        {/* Fallback gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0e20] via-[#0d0d18] to-[#0a1020]" />

        {/* Card art */}
        {heroArt && (
          <img
            src={heroArt}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-opacity duration-700"
            style={{
              opacity: heroLoaded ? 0.35 : 0,
              filter: "saturate(1.3) brightness(0.65)",
            }}
            onLoad={() => setHeroLoaded(true)}
          />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/50 via-transparent to-bg-primary/50" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-14 pb-10 text-center">
          <h1 className="animate-houdini font-mtg text-mtg-gradient text-4xl font-black leading-tight mb-2 drop-shadow-lg">
            MTG Houdini
          </h1>
          <p className="text-text-secondary text-sm mb-8 max-w-xs">
            Your ultimate Magic: The Gathering companion
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="w-full max-w-sm">
            <div className="relative flex items-center">
              <svg
                className="absolute left-3.5 w-4 h-4 text-text-muted pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards…"
                className="w-full bg-bg-card/80 backdrop-blur border border-border rounded-xl pl-10 pr-24 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-4 py-1.5 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-dark transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {heroCard && (
            <p className="text-[10px] text-text-muted mt-3 opacity-50">
              Art: {heroCard.name}
              {heroCard.artist && <> · {heroCard.artist}</>}
            </p>
          )}
        </div>
      </div>

      {/* ── Feature Grid ── */}
      <div className="px-4 pt-1 pb-4">
        <p className="font-display text-[11px] font-bold text-text-muted tracking-widest uppercase mb-3">
          Features
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((feature) => (
            <Link key={feature.href} href={feature.href}>
              <div className="group relative bg-bg-card border border-border rounded-xl p-4 overflow-hidden transition-all duration-200 active:scale-95 hover:border-accent/40">
                {/* Corner glow */}
                <div
                  className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-15 blur-xl transition-opacity duration-200 group-hover:opacity-25"
                  style={{ background: feature.accent }}
                />

                <div className="relative z-10">
                  <div
                    className="mb-3 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${feature.accent}22`, color: feature.accent }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Search shortcut ── */}
      <div className="px-4 pb-4">
        <Link href="/search">
          <div className="flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 py-3 hover:border-accent/40 transition-colors active:scale-[0.98]">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-text-primary">BROWSE ALL CARDS</p>
              <p className="text-[11px] text-text-muted truncate">Search the full Scryfall database</p>
            </div>
            <svg className="ml-auto w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}
