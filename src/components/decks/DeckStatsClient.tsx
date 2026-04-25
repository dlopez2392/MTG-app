"use client";

import { useEffect, useState } from "react";
import { useDecks, useDeckCards } from "@/hooks/useDecks";
import { calculateDeckStats } from "@/lib/utils/deckStats";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import ManaCurveChart from "@/components/decks/stats/ManaCurveChart";
import ColorPieChart from "@/components/decks/stats/ColorPieChart";
import TypeBreakdown from "@/components/decks/stats/TypeBreakdown";
import DeckIntelligence from "@/components/decks/stats/DeckIntelligence";
import type { Deck, DeckStats } from "@/types/deck";

const RARITY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  common: { bg: "rgba(156,163,175,0.15)", text: "#9CA3AF", glow: "rgba(156,163,175,0.3)" },
  uncommon: { bg: "rgba(192,192,192,0.15)", text: "#C0C0C0", glow: "rgba(192,192,192,0.3)" },
  rare: { bg: "rgba(212,168,67,0.15)", text: "#D4A843", glow: "rgba(212,168,67,0.3)" },
  mythic: { bg: "rgba(211,32,42,0.15)", text: "#D3202A", glow: "rgba(211,32,42,0.3)" },
};

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  mythic: "Mythic",
};

interface Props {
  deckId: string;
}

function StatCard({ label, value, sub, gradient }: { label: string; value: string; sub?: string; gradient: string }) {
  return (
    <div
      className="relative rounded-2xl p-[1px] overflow-hidden"
      style={{ background: gradient }}
    >
      <div
        className="rounded-2xl px-4 py-5 text-center backdrop-blur-xl h-full"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(30,30,45,0.9) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-[11px] text-white/50 mt-1 uppercase tracking-wider font-medium">{label}</p>
        {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function GlassSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-[1px] overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)",
      }}
    >
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(15,15,25,0.95) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))" }}
          >
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function DeckStatsClient({ deckId }: Props) {
  const { getDeck } = useDecks();
  const { cards } = useDeckCards(deckId);
  const [deck, setDeck] = useState<Deck | undefined>();

  useEffect(() => {
    getDeck(deckId).then(setDeck);
  }, [deckId]);

  const stats: DeckStats | null = cards ? calculateDeckStats(cards) : null;

  if (!stats) {
    return (
      <>
        <TopBar title="Deck Stats" showBack />
        <PageContainer>
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        </PageContainer>
      </>
    );
  }

  const landPct = stats.totalCards > 0 ? ((stats.landCount / stats.totalCards) * 100).toFixed(0) : "0";

  return (
    <>
      <TopBar title={deck ? `${deck.name} - Stats` : "Deck Stats"} showBack />
      <PageContainer>
        <div className="flex flex-col gap-5 max-w-2xl pb-8">

          {/* ── Summary stat cards ── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total Cards"
              value={String(stats.totalCards)}
              sub={`${stats.uniqueCards} unique`}
              gradient="linear-gradient(135deg, rgba(59,130,246,0.4), rgba(59,130,246,0.1))"
            />
            <StatCard
              label="Avg Mana Value"
              value={stats.averageCmc.toFixed(2)}
              sub={`${stats.landCount} lands`}
              gradient="linear-gradient(135deg, rgba(168,85,247,0.4), rgba(168,85,247,0.1))"
            />
            <StatCard
              label="Total Value"
              value={`$${stats.totalValue.toFixed(0)}`}
              sub={stats.totalValue > 0 ? `~$${(stats.totalValue / stats.totalCards).toFixed(2)}/card` : undefined}
              gradient="linear-gradient(135deg, rgba(234,179,8,0.4), rgba(234,179,8,0.1))"
            />
          </div>

          {/* ── Land / Nonland ratio ── */}
          <div
            className="rounded-2xl p-[1px] overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(59,130,246,0.3))" }}
          >
            <div
              className="rounded-2xl px-5 py-4"
              style={{
                background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Lands vs Spells</span>
                <span className="text-xs text-white/40">{landPct}% lands</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                {stats.nonlandCount > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(stats.nonlandCount / stats.totalCards) * 100}%`,
                      background: "linear-gradient(90deg, #3B82F6, #6366F1)",
                    }}
                  />
                )}
                {stats.landCount > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(stats.landCount / stats.totalCards) * 100}%`,
                      background: "linear-gradient(90deg, #22C55E, #16A34A)",
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-blue-400 font-medium">{stats.nonlandCount} spells</span>
                <span className="text-xs text-green-400 font-medium">{stats.landCount} lands</span>
              </div>
            </div>
          </div>

          {/* ── Mana Curve ── */}
          <GlassSection
            title="Mana Curve"
            icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          >
            <ManaCurveChart manaCurve={stats.manaCurve} />
          </GlassSection>

          {/* ── Color Distribution ── */}
          <GlassSection
            title="Color Distribution"
            icon="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z"
          >
            <ColorPieChart colorDistribution={stats.colorDistribution} />
          </GlassSection>

          {/* ── Type Breakdown ── */}
          <GlassSection
            title="Type Breakdown"
            icon="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          >
            <TypeBreakdown typeBreakdown={stats.typeBreakdown} />
          </GlassSection>

          {/* ── Rarity Breakdown ── */}
          <GlassSection
            title="Rarity Breakdown"
            icon="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          >
            <div className="grid grid-cols-2 gap-2">
              {["mythic", "rare", "uncommon", "common"].map((rarity) => {
                const count = stats.rarityBreakdown[rarity] ?? 0;
                if (count === 0) return null;
                const colors = RARITY_COLORS[rarity];
                return (
                  <div
                    key={rarity}
                    className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{
                      background: colors.bg,
                      boxShadow: `inset 0 0 20px ${colors.glow}, 0 2px 8px rgba(0,0,0,0.2)`,
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: colors.text }}>
                      {RARITY_LABELS[rarity]}
                    </span>
                    <span className="text-lg font-bold" style={{ color: colors.text }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassSection>

          {/* ── Category Breakdown ── */}
          {Object.keys(stats.categoryBreakdown).length > 1 && (
            <GlassSection
              title="Categories"
              icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.categoryBreakdown).map(([cat, count]) => (
                  <div
                    key={cat}
                    className="rounded-xl px-4 py-2.5 flex items-center gap-2"
                    style={{
                      background: "rgba(124,92,252,0.1)",
                      boxShadow: "inset 0 0 12px rgba(124,92,252,0.08)",
                    }}
                  >
                    <span className="text-xs text-white/50 capitalize">{cat}</span>
                    <span className="text-sm font-bold text-white/80">{count}</span>
                  </div>
                ))}
              </div>
            </GlassSection>
          )}

          {/* ── Most Valuable Cards ── */}
          {stats.topCards.length > 0 && (
            <GlassSection
              title="Most Valuable Cards"
              icon="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            >
              <div className="flex flex-col gap-2">
                {stats.topCards.map((card, i) => (
                  <div
                    key={card.name}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{
                      background: i === 0
                        ? "linear-gradient(135deg, rgba(234,179,8,0.12), rgba(234,179,8,0.04))"
                        : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{
                        background: i === 0
                          ? "linear-gradient(135deg, #D4A843, #A07828)"
                          : "rgba(255,255,255,0.08)",
                        color: i === 0 ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {i + 1}
                    </span>
                    {card.imageUri && (
                      <img
                        src={card.imageUri}
                        alt=""
                        className="w-8 h-11 rounded object-cover flex-shrink-0"
                        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                      />
                    )}
                    <span className="text-sm text-white/80 truncate flex-1">{card.name}</span>
                    <span className="text-sm font-bold text-amber-400 flex-shrink-0">${card.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </GlassSection>
          )}

          {/* ── Deck Intelligence ── */}
          {cards && cards.length > 0 && (
            <DeckIntelligence cards={cards} />
          )}
        </div>
      </PageContainer>
    </>
  );
}
