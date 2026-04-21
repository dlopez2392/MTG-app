"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NewsWidget from "@/components/news/NewsWidget";

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
    href: "/trades",
    title: "TRADING",
    description: "Track & evaluate card trades",
    accent: "#F97316",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    href: "/games",
    title: "GAME LOG",
    description: "Track wins, losses & stats",
    accent: "#06B6D4",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
  },
  {
    href: "/wishlist",
    title: "WISHLIST",
    description: "Track cards & set price alerts",
    accent: "#F59E0B",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
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
];

export default function HomePage() {
  const [heroCard, setHeroCard] = useState<HeroCard | null>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    fetch("https://api.scryfall.com/cards/random?q=type%3Alegendary")
      .then((r) => r.json())
      .then((card: HeroCard) => setHeroCard(card))
      .catch(() => {});
  }, []);

  const heroArt =
    heroCard?.image_uris?.art_crop ??
    heroCard?.card_faces?.[0]?.image_uris?.art_crop;

  return (
    <div className="flex flex-col min-h-screen pb-20 animate-page-enter">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 300 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-via to-hero-to" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(237,154,87,0.08) 0%, transparent 70%)" }} />

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
          <p className="text-body text-text-secondary mb-4 max-w-xs">
            Your ultimate Magic: The Gathering companion
          </p>

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 [grid-auto-rows:1fr]">
          {FEATURES.map((feature) => (
            <Link key={feature.href} href={feature.href} className="block h-full">
              <div className="group relative bg-bg-card border border-border rounded-2xl p-4 overflow-hidden transition-all duration-200 active:scale-95 hover:border-accent/30 h-full">
                {/* Subtle top accent line */}
                <div
                  className="absolute top-0 left-4 right-4 h-[2px] opacity-60 group-hover:opacity-90 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}, transparent)` }}
                />
                {/* Corner glow */}
                <div
                  className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-30 blur-2xl transition-opacity duration-200 group-hover:opacity-45"
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
