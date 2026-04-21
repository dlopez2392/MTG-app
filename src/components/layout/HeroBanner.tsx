"use client";

import { useState, useEffect } from "react";

interface HeroBannerProps {
  title: string;
  subtitle?: string;
  accent: string;         // hex colour for icon bg + corner glow
  icon: React.ReactNode;
  children?: React.ReactNode; // optional content rendered below the title (e.g. search bar)
  onBack?: () => void;
}

interface HeroCard {
  name: string;
  artist?: string;
  image_uris?: { art_crop?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string } }>;
}

export default function HeroBanner({ title, subtitle, accent, icon, children, onBack }: HeroBannerProps) {
  const [card, setCard] = useState<HeroCard | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("https://api.scryfall.com/cards/random?q=type%3Alegendary")
      .then((r) => r.json())
      .then((c: HeroCard) => setCard(c))
      .catch(() => {});
  }, []);

  const art =
    card?.image_uris?.art_crop ??
    card?.card_faces?.[0]?.image_uris?.art_crop;

  return (
    <div className="relative" style={{ minHeight: children ? 180 : 130 }}>
      {/* Background layers — clipped separately so the dropdown can overflow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Fallback gradient — theme-aware via CSS variables */}
        <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-via to-hero-to" />

        {/* Card art */}
        {art && (
          <img
            src={art}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-opacity duration-700 hero-art"
            style={{ opacity: loaded ? 0.32 : 0 }}
            onLoad={() => setLoaded(true)}
          />
        )}

        {/* Vignette overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/60 via-transparent to-bg-primary/60" />

        {/* Corner accent glow */}
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: accent }}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 px-4 pt-8 pb-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-bg-card/60 backdrop-blur border border-border/50 flex items-center justify-center text-text-muted hover:text-text-primary active:scale-90 transition-all cursor-pointer flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}18`, color: accent, boxShadow: `0 0 20px ${accent}30` }}
          >
            {icon}
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-text-primary leading-tight tracking-wide uppercase">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {children && <div className="mt-4">{children}</div>}

        {card && (
          <p className="text-[9px] text-text-muted opacity-40 mt-2">
            Art: {card.name}{card.artist && <> · {card.artist}</>}
          </p>
        )}
      </div>
    </div>
  );
}
