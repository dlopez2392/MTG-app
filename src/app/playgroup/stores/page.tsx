"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";

interface LocationState {
  status: "idle" | "loading" | "granted" | "denied" | "unavailable";
  lat?: number;
  lng?: number;
}

const SEARCH_CATEGORIES = [
  {
    label: "Local Game Stores",
    query: "local game store MTG",
    icon: "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z",
    color: "#7C5CFC",
  },
  {
    label: "Card & Comic Shops",
    query: "trading card game shop",
    icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v13.5a1.5 1.5 0 001.5 1.5zm6-13.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z",
    color: "#3B82F6",
  },
  {
    label: "Board Game Cafés",
    query: "board game cafe",
    icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z",
    color: "#F59E0B",
  },
  {
    label: "Commander Nights",
    query: "commander night MTG event",
    icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0",
    color: "#22C55E",
  },
];

function buildMapsUrl(query: string, lat?: number, lng?: number) {
  const base = "https://www.google.com/maps/search/";
  const q = encodeURIComponent(query);
  if (lat !== undefined && lng !== undefined) {
    return `${base}${q}/@${lat},${lng},13z`;
  }
  return `${base}${q}`;
}

export default function StoreFinderPage() {
  const router = useRouter();
  const [loc, setLoc] = useState<LocationState>({ status: "idle" });
  const [customSearch, setCustomSearch] = useState("");

  useEffect(() => {
    requestLocation();
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLoc({ status: "unavailable" });
      return;
    }
    setLoc({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setLoc({ status: "granted", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setLoc({ status: err.code === 1 ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  const ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Find a Store"
        subtitle="Discover game stores and events near you"
        accent="#7C5CFC"
        icon={ICON}
        onBack={() => router.push("/playgroup")}
      />

      <PageContainer>
        <div className="flex flex-col gap-4 max-w-2xl pb-8">

          {/* Location status */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: loc.status === "granted"
                    ? "rgba(34,197,94,0.15)"
                    : loc.status === "loading"
                    ? "rgba(124,92,252,0.15)"
                    : "rgba(239,68,68,0.15)",
                }}
              >
                {loc.status === "loading" ? (
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{
                      color: loc.status === "granted" ? "#22C55E" : "#EF4444",
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {loc.status === "granted" && (
                  <>
                    <p className="text-sm font-semibold text-legal">Location detected</p>
                    <p className="text-xs text-text-muted">Results will be sorted by distance</p>
                  </>
                )}
                {loc.status === "loading" && (
                  <>
                    <p className="text-sm font-semibold text-text-primary">Detecting location…</p>
                    <p className="text-xs text-text-muted">Allow location access for nearby results</p>
                  </>
                )}
                {loc.status === "denied" && (
                  <>
                    <p className="text-sm font-semibold text-banned">Location access denied</p>
                    <p className="text-xs text-text-muted">You can still search — results won&apos;t be distance-sorted</p>
                  </>
                )}
                {loc.status === "unavailable" && (
                  <>
                    <p className="text-sm font-semibold text-text-secondary">Location unavailable</p>
                    <p className="text-xs text-text-muted">Search will use your general area</p>
                  </>
                )}
                {loc.status === "idle" && (
                  <>
                    <p className="text-sm font-semibold text-text-secondary">Location not requested</p>
                    <p className="text-xs text-text-muted">Tap to enable nearby results</p>
                  </>
                )}
              </div>
              {(loc.status === "denied" || loc.status === "idle" || loc.status === "unavailable") && (
                <button
                  onClick={requestLocation}
                  className="text-xs text-accent font-semibold hover:underline flex-shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
          </div>

          {/* Search categories */}
          <div className="grid grid-cols-2 gap-3">
            {SEARCH_CATEGORIES.map((cat) => (
              <a
                key={cat.label}
                href={buildMapsUrl(cat.query, loc.lat, loc.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card rounded-2xl border border-border p-4 flex flex-col items-center gap-3 text-center transition-all active:scale-95 hover:border-white/20"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${cat.color}20` }}
                >
                  <svg className="w-6 h-6" style={{ color: cat.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{cat.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Open in Maps</p>
                </div>
              </a>
            ))}
          </div>

          {/* Custom search */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
              Custom Search
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                placeholder="e.g. Friday Night Magic, Draft event…"
                className="input-base flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customSearch.trim()) {
                    window.open(buildMapsUrl(customSearch.trim(), loc.lat, loc.lng), "_blank");
                  }
                }}
              />
              <a
                href={customSearch.trim() ? buildMapsUrl(customSearch.trim(), loc.lat, loc.lng) : "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!customSearch.trim()) e.preventDefault(); }}
                className="px-4 py-2 rounded-xl btn-gradient text-sm font-bold flex items-center gap-1.5 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Search
              </a>
            </div>
          </div>

          {/* Tips section */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Tips for Finding Games</h3>
            <div className="flex flex-col gap-2.5">
              {[
                { tip: "Ask your LGS about Commander night schedules — most stores run weekly pods", icon: "📅" },
                { tip: "Check store social media or Discord for last-minute event announcements", icon: "💬" },
                { tip: "Wizards Event Locator (locator.wizards.com) lists sanctioned events", icon: "🔍" },
                { tip: "Bring decks at multiple bracket levels so you can match any pod", icon: "🎯" },
              ].map((item) => (
                <div key={item.tip} className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                  <p className="text-xs text-text-muted leading-relaxed">{item.tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Wizards Store Locator link */}
          <a
            href="https://locator.wizards.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card rounded-2xl border border-border p-4 flex items-center gap-3 transition-all active:scale-[0.98] hover:border-accent/30"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(124,92,252,0.15)" }}
            >
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Wizards Store & Event Locator</p>
              <p className="text-xs text-text-muted">Official WPN store finder — sanctioned events, prereleases, FNM</p>
            </div>
            <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </PageContainer>
    </>
  );
}
