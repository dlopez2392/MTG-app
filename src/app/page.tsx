"use client";

import Link from "next/link";
import NewsWidget from "@/components/news/NewsWidget";

const FEATURES = [
  {
    href: "/brackets",
    title: "BRACKETS",
    description: "Commander power level & Rule 0",
    accent: "#EF4444",
    art: "https://cards.scryfall.io/art_crop/front/c/4/c46a217c-0ed2-4b3c-9a01-ee38d12d76f3.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: "/rules",
    title: "RULEBOOK",
    description: "Comprehensive rules & glossary",
    accent: "#A855F7",
    art: "https://cards.scryfall.io/art_crop/front/9/5/95e307d4-7e5f-4f00-869e-da0e7abbf27f.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: "/trades",
    title: "TRADING",
    description: "Track & evaluate card trades",
    accent: "#F97316",
    art: "https://cards.scryfall.io/art_crop/front/c/8/c88acaa8-ad4d-4321-a6f6-9361916e5b5e.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    href: "/wishlist",
    title: "WISHLIST",
    description: "Track cards & set price alerts",
    accent: "#F59E0B",
    art: "https://cards.scryfall.io/art_crop/front/8/6/861b5889-0183-4bee-afeb-a4b2aa700a8e.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    href: "/playgroup",
    title: "PLAYGROUP",
    description: "Track your pod & head-to-head stats",
    accent: "#8B5CF6",
    art: "https://cards.scryfall.io/art_crop/front/9/7/97fa8615-2b6c-445a-bcaf-44a7e847bf65.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/games",
    title: "GAME LOG",
    description: "Track wins, losses & stats",
    accent: "#06B6D4",
    art: "https://cards.scryfall.io/art_crop/front/5/2/5252794a-5cbe-45e3-b5c1-b27c667e9c17.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen pb-20 animate-page-enter">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from/60 via-transparent to-hero-to/60" />
        <div className="absolute inset-0 glow-radial-accent" />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-12 pb-4 text-center max-w-2xl mx-auto w-full">
          <h1 className="animate-houdini font-mtg text-mtg-gradient text-hero mb-1 drop-shadow-lg">
            MTG Houdini
          </h1>
          <p className="text-body text-text-secondary max-w-xs">
            Your ultimate Magic: The Gathering companion
          </p>
        </div>
      </div>

      {/* ── Search shortcut ── */}
      <div className="px-4 pt-1 pb-2 max-w-2xl mx-auto w-full">
        <Link href="/search">
          <div className="flex items-center gap-3 glass-card border border-border rounded-2xl px-4 py-3.5 hover:border-accent/40 transition-colors active:scale-[0.98]">
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
      <div className="px-4 pb-3 max-w-2xl mx-auto w-full">
        <p className="text-section-label text-text-muted mb-3">
          Features
        </p>
        <div className="grid grid-cols-2 gap-3.5 [grid-auto-rows:1fr]">
          {FEATURES.map((feature) => (
            <Link key={feature.href} href={feature.href} className="block h-full">
              <div className="group relative glass-card border border-border rounded-2xl p-4 overflow-hidden transition-all duration-200 active:scale-95 hover:border-accent/30 h-full">
                {/* Background art */}
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={feature.art}
                    alt=""
                    className="w-full h-full object-cover opacity-35 group-hover:opacity-45 transition-opacity duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 via-bg-primary/40 to-transparent" />
                </div>
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
