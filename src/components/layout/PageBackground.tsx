"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface BgCard {
  image_uris?: { art_crop?: string };
  card_faces?: Array<{ image_uris?: { art_crop?: string } }>;
}

export default function PageBackground() {
  const pathname = usePathname();
  const [art, setArt] = useState<string | null>(null);
  const [nextArt, setNextArt] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const fetchArt = useCallback(() => {
    fetch("https://api.scryfall.com/cards/random?q=type%3Alegendary")
      .then((r) => r.json())
      .then((c: BgCard) => {
        const url = c.image_uris?.art_crop ?? c.card_faces?.[0]?.image_uris?.art_crop;
        if (!url) return;
        if (!art) {
          setArt(url);
        } else {
          setNextArt(url);
          setTransitioning(true);
        }
      })
      .catch(() => {});
  }, [art]);

  useEffect(() => {
    fetchArt();
  }, [pathname]);

  useEffect(() => {
    if (!transitioning || !nextArt) return;
    const timer = setTimeout(() => {
      setArt(nextArt);
      setNextArt(null);
      setTransitioning(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [transitioning, nextArt]);

  if (!art) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <img
        key={art}
        src={art}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: transitioning ? 0 : 1,
          filter: "brightness(0.12) saturate(0.6)",
          transition: "opacity 0.8s ease-in-out",
        }}
      />
      {nextArt && (
        <img
          key={nextArt}
          src={nextArt}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: transitioning ? 1 : 0,
            filter: "brightness(0.12) saturate(0.6)",
            transition: "opacity 0.8s ease-in-out",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/40 via-transparent to-bg-primary/60" />
    </div>
  );
}
