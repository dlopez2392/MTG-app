"use client";

import { useState, useEffect } from "react";

interface HeroBannerProps {
  title: string;
  subtitle?: string;
  accent: string;         // hex colour for icon bg + corner glow
  icon: React.ReactNode;
  children?: React.ReactNode; // optional content rendered below the title (e.g. search bar)
}

interface HeroCard {
  name: string;
  artist?: string;
  image_uris?: { art_crop?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string } }>;
}

export default function HeroBanner({ title, subtitle, accent, icon, children }: HeroBannerProps) {
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
        {/* Fallback gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0e20] via-[#0d0d18] to-[#0a1020]" />

        {/* Card art */}
        {art && (
          <img
            src={art}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-105 transition-opacity duration-700"
            style={{ opacity: loaded ? 0.32 : 0, filter: "saturate(1.3) brightness(0.6)" }}
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
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ background: `${accent}28`, color: accent, boxShadow: `0 0 16px ${accent}40` }}
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
