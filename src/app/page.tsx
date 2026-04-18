"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NewsWidget from "@/components/news/NewsWidget";

interface HeroCard {
  name: string;
  artist?: string;
  image_uris?: { art_crop?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string } }>;
}

const FEATURES = [
  {
    href: "/rules",
    title: "RULEBOOK",
    description: "Comprehensive rules & glossary",
    accent: "#A855F7",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
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
    accent: "#7C5CFC",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
  },
  {
    href: "/wishlist",
    title: "WISHLIST",
    description: "Track cards & set price alerts",
    accent: "#EC4899",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    href: "/games",
    title: "GAME LOG",
    description: "Track wins, losses & stats",
    accent: "#3B82F6",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
  },
  {
    href: "/packages",
    title: "PACKAGES",
    description: "Commander staple bundles",
    accent: "#F59E0B",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
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
    <div className="flex flex-col min-h-screen pb-20 animate-page-enter">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 300 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-via to-hero-to" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,92,252,0.08) 0%, transparent 70%)" }} />

        {heroArt && (
          <img
            src={heroArt}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-opacity duration-700 hero-art"
            style={{ opacity: heroLoaded ? 0.5 : 0 }}
            onLoad={() => setHeroLoaded(true)}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/60 via-transparent to-bg-primary/60" />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-14 pb-10 text-center max-w-2xl mx-auto w-full">
          <h1 className="animate-houdini font-mtg text-mtg-gradient text-hero mb-2 drop-shadow-lg">
            MTG Houdini
          </h1>
          <p className="text-body text-text-secondary mb-8 max-w-xs">
            Your ultimate Magic: The Gathering companion
          </p>

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
                className="w-full bg-bg-card/80 backdrop-blur border border-border rounded-2xl pl-10 pr-24 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/50 transition-colors"
              />
              <button
                type="submit"
                suppressHydrationWarning
                className="absolute right-1.5 px-4 py-1.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
              >
                Search
              </button>
            </div>
          </form>

          {heroCard && (
            <p className="text-caption mt-3 opacity-50">
              Art: {heroCard.name}
              {heroCard.artist && <> · {heroCard.artist}</>}
            </p>
          )}
        </div>
      </div>

      {/* ── Search shortcut ── */}
      <div className="px-4 pt-1 pb-4 max-w-2xl mx-auto w-full">
        <Link href="/search">
          <div className="flex items-center gap-3 bg-bg-card border border-border rounded-2xl px-4 py-3.5 hover:border-accent/40 transition-colors active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-page-title text-text-primary">BROWSE ALL CARDS</p>
              <p className="text-caption truncate">Search the full Scryfall database</p>
            </div>
            <svg className="ml-auto w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* ── Feature Grid ── */}
      <div className="px-4 pb-4 max-w-2xl mx-auto w-full">
        <p className="text-section-label text-text-muted mb-3">
          Features
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 [grid-auto-rows:1fr]">
          {FEATURES.map((feature) => (
            <Link key={feature.href} href={feature.href} className="block h-full">
              <div className="group relative bg-bg-card border border-border rounded-2xl p-4 overflow-hidden transition-all duration-200 active:scale-95 hover:border-accent/30 h-full">
                {/* Subtle top accent line */}
                <div
                  className="absolute top-0 left-4 right-4 h-px opacity-40 group-hover:opacity-70 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}, transparent)` }}
                />
                {/* Corner glow */}
                <div
                  className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 blur-2xl transition-opacity duration-200 group-hover:opacity-20"
                  style={{ background: feature.accent }}
                />

                <div className="relative z-10">
                  <div
                    className="mb-3 w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${feature.accent}18`, color: feature.accent }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-page-title text-text-primary leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-caption mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── News ── */}
      <NewsWidget />
    </div>
  );
}
