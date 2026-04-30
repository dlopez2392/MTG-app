"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import { useDecks, useDeckCards } from "@/hooks/useDecks";
import { usePlaygroup } from "@/hooks/usePlaygroup";
import { cn } from "@/lib/utils/cn";
import type { DeckCard } from "@/types/deck";

interface FriendDeckMeta {
  id: string;
  name: string;
  format: string | null;
  cardCount: number;
}

interface FriendDeckFull {
  id: string;
  name: string;
  format: string | null;
  cards: { name: string; quantity: number; category: string; typeLine?: string | null; manaCost?: string | null; cmc?: number | null }[];
}

interface MatchupResult {
  favored: "A" | "B" | "even";
  confidence: string;
  favoredReason: string;
  estimatedWinRate: string;
  keyInteractions: { description: string; advantage: "A" | "B" }[];
  deckAStrengths: string[];
  deckAWeaknesses: string[];
  deckBStrengths: string[];
  deckBWeaknesses: string[];
  pilotingAdviceA: string;
  pilotingAdviceB: string;
  swingCards: { card: string; deck: "A" | "B"; impact: string }[];
}

function DeckCardLoader({ deckId, onCards }: { deckId: string; onCards: (cards: DeckCard[]) => void }) {
  const { cards } = useDeckCards(deckId);
  if (cards && cards.length > 0) {
    onCards(cards);
  }
  return null;
}

function MatchupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { allDecks: decks } = useDecks();
  const { members } = usePlaygroup();
  const [deckAId, setDeckAId] = useState(searchParams.get("deckA") ?? "");
  const [deckBId, setDeckBId] = useState("");
  const [cardsA, setCardsA] = useState<DeckCard[]>([]);
  const [cardsB, setCardsB] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchupResult | null>(null);
  const [error, setError] = useState("");

  // Friend deck state
  const [deckBSource, setDeckBSource] = useState<"mine" | "friend">("mine");
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [friendDecks, setFriendDecks] = useState<FriendDeckMeta[]>([]);
  const [friendDecksLoading, setFriendDecksLoading] = useState(false);
  const [friendDeckData, setFriendDeckData] = useState<FriendDeckFull | null>(null);
  const [friendDeckLoading, setFriendDeckLoading] = useState(false);

  const linkedMembers = members.filter((m) => m.friendUserId);

  const loadFriendDecks = useCallback(async (memberId: string) => {
    setFriendDecksLoading(true);
    setFriendDecks([]);
    try {
      const res = await fetch(`/api/playgroup/${memberId}/decks`);
      const data = await res.json();
      if (Array.isArray(data)) setFriendDecks(data);
    } catch {}
    setFriendDecksLoading(false);
  }, []);

  const loadFriendDeckCards = useCallback(async (memberId: string, friendDeckId: string) => {
    setFriendDeckLoading(true);
    setFriendDeckData(null);
    setCardsB([]);
    try {
      const res = await fetch(`/api/playgroup/${memberId}/decks/${friendDeckId}`);
      const data = await res.json();
      if (data.cards) {
        setFriendDeckData(data);
        setCardsB(data.cards.map((c: FriendDeckFull["cards"][0]) => ({
          name: c.name, quantity: c.quantity, category: c.category,
          typeLine: c.typeLine ?? undefined, manaCost: c.manaCost ?? undefined,
          cmc: c.cmc ?? undefined,
        })) as DeckCard[]);
      }
    } catch {}
    setFriendDeckLoading(false);
  }, []);

  const deckA = decks.find((d) => d.id === deckAId);
  const deckB = deckBSource === "mine" ? decks.find((d) => d.id === deckBId) : null;
  const deckBName = deckBSource === "friend" ? friendDeckData?.name : deckB?.name;
  const deckBFormat = deckBSource === "friend" ? friendDeckData?.format : deckB?.format;

  const analyze = useCallback(async () => {
    if (!deckA || cardsA.length === 0 || cardsB.length === 0 || !deckBName) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/matchup-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckA: {
            name: deckA.name,
            format: deckA.format,
            cards: cardsA.map((c) => ({
              name: c.name, quantity: c.quantity, category: c.category,
              typeLine: c.typeLine, manaCost: c.manaCost, cmc: c.cmc,
            })),
          },
          deckB: {
            name: deckBName,
            format: deckBFormat,
            cards: cardsB.map((c) => ({
              name: c.name, quantity: c.quantity, category: c.category,
              typeLine: c.typeLine, manaCost: c.manaCost, cmc: c.cmc,
            })),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [deckA, deckBName, deckBFormat, cardsA, cardsB]);

  const ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );

  const canAnalyze = deckAId && cardsA.length > 0 && cardsB.length > 0 && deckBName &&
    (deckBSource === "friend" || (deckBId && deckAId !== deckBId));

  return (
    <>
      <HeroBanner
        title="Matchup Analysis"
        subtitle="Compare two decks head-to-head with AI"
        accent="#7C5CFC"
        icon={ICON}
        onBack={() => router.back()}
      />

      {/* Hidden card loaders */}
      {deckAId && <DeckCardLoader deckId={deckAId} onCards={setCardsA} />}
      {deckBSource === "mine" && deckBId && <DeckCardLoader deckId={deckBId} onCards={setCardsB} />}

      <PageContainer>
        <div className="flex flex-col gap-4 max-w-2xl pb-8">

          {/* Deck A selector */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}
              >
                A
              </span>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Your Deck</span>
            </div>
            <select
              value={deckAId}
              onChange={(e) => { setDeckAId(e.target.value); setCardsA([]); setResult(null); }}
              className="w-full rounded-xl px-3 py-2 text-sm text-white/80 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <option value="">Select your deck…</option>
              {decks.filter((d) => d.id !== deckBId).map((d) => (
                <option key={d.id} value={d.id ?? ""}>{d.name}{d.format ? ` (${d.format})` : ""}</option>
              ))}
            </select>
            {deckA && cardsA.length > 0 && (
              <p className="text-[10px] text-text-muted mt-1.5">{cardsA.reduce((s, c) => s + c.quantity, 0)} cards loaded</p>
            )}
          </div>

          {/* VS divider */}
          {deckAId && (
            <div className="flex items-center justify-center">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                style={{ background: "rgba(124,92,252,0.15)", color: "#7C5CFC" }}
              >
                VS
              </span>
            </div>
          )}

          {/* Deck B selector */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
              >
                B
              </span>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Opponent Deck</span>
            </div>

            {/* Source toggle */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 mb-3">
              <button
                onClick={() => { setDeckBSource("mine"); setCardsB([]); setFriendDeckData(null); setResult(null); }}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                  deckBSource === "mine" ? "btn-gradient" : "text-text-muted hover:text-text-secondary"
                )}
              >
                My Decks
              </button>
              <button
                onClick={() => { setDeckBSource("friend"); setDeckBId(""); setCardsB([]); setResult(null); }}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                  deckBSource === "friend" ? "btn-gradient" : "text-text-muted hover:text-text-secondary",
                  linkedMembers.length === 0 && "opacity-40 cursor-not-allowed"
                )}
                disabled={linkedMembers.length === 0}
                title={linkedMembers.length === 0 ? "No linked playgroup members with shared decks" : undefined}
              >
                Friend&apos;s Deck
              </button>
            </div>

            {deckBSource === "mine" ? (
              <>
                <select
                  value={deckBId}
                  onChange={(e) => { setDeckBId(e.target.value); setCardsB([]); setResult(null); }}
                  className="w-full rounded-xl px-3 py-2 text-sm text-white/80 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <option value="">Select deck…</option>
                  {decks.filter((d) => d.id !== deckAId).map((d) => (
                    <option key={d.id} value={d.id ?? ""}>{d.name}{d.format ? ` (${d.format})` : ""}</option>
                  ))}
                </select>
                {deckB && cardsB.length > 0 && (
                  <p className="text-[10px] text-text-muted mt-1.5">{cardsB.reduce((s, c) => s + c.quantity, 0)} cards loaded</p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {/* Friend selector */}
                <select
                  value={selectedFriendId}
                  onChange={(e) => {
                    const mid = e.target.value;
                    setSelectedFriendId(mid);
                    setFriendDecks([]);
                    setFriendDeckData(null);
                    setCardsB([]);
                    setResult(null);
                    if (mid) loadFriendDecks(mid);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm text-white/80 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <option value="">Select friend…</option>
                  {linkedMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                {/* Friend's deck selector */}
                {selectedFriendId && (
                  friendDecksLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-text-muted">Loading decks…</span>
                    </div>
                  ) : friendDecks.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">No public decks shared by this friend.</p>
                  ) : (
                    <select
                      value={friendDeckData?.id ?? ""}
                      onChange={(e) => {
                        const fdId = e.target.value;
                        if (fdId && selectedFriendId) {
                          loadFriendDeckCards(selectedFriendId, fdId);
                          setResult(null);
                        }
                      }}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white/80 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <option value="">Select their deck…</option>
                      {friendDecks.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}{d.format ? ` (${d.format})` : ""} — {d.cardCount} cards</option>
                      ))}
                    </select>
                  )
                )}

                {friendDeckLoading && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-text-muted">Loading deck cards…</span>
                  </div>
                )}

                {friendDeckData && cardsB.length > 0 && (
                  <p className="text-[10px] text-text-muted">{cardsB.reduce((s, c) => s + c.quantity, 0)} cards loaded from {friendDeckData.name}</p>
                )}
              </div>
            )}
          </div>

          {/* Analyze button */}
          <button
            onClick={analyze}
            disabled={!canAnalyze || loading}
            className="w-full px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #7C5CFC, #6347E0)",
              color: "white",
              boxShadow: canAnalyze ? "0 4px 20px rgba(124,92,252,0.4)" : "none",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing matchup…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Analyze Matchup
              </span>
            )}
          </button>

          {!deckAId && !deckBId && decks.length < 2 && (
            <p className="text-xs text-text-muted text-center py-2">You need at least 2 decks to compare. Create some on the Decks page first.</p>
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 bg-banned/10 border border-banned/20">
              <p className="text-sm text-banned">{error}</p>
              <button onClick={analyze} className="mt-2 text-xs text-banned/70 hover:text-banned">Try again</button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="flex flex-col gap-3">

              {/* Verdict card */}
              <div
                className="rounded-2xl p-[1px] overflow-hidden"
                style={{
                  background: result.favored === "A"
                    ? "linear-gradient(135deg, rgba(59,130,246,0.5), rgba(59,130,246,0.1))"
                    : result.favored === "B"
                    ? "linear-gradient(135deg, rgba(239,68,68,0.5), rgba(239,68,68,0.1))"
                    : "linear-gradient(135deg, rgba(124,92,252,0.5), rgba(124,92,252,0.1))",
                }}
              >
                <div
                  className="rounded-2xl p-5"
                  style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.9), rgba(15,15,25,0.95))" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-2xl font-black"
                        style={{
                          color: result.favored === "A" ? "#3B82F6"
                            : result.favored === "B" ? "#EF4444" : "#7C5CFC"
                        }}
                      >
                        {result.favored === "even" ? "EVEN" : result.favored === "A" ? deckA?.name : deckBName}
                      </span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                      style={{
                        background: result.confidence === "high" ? "rgba(34,197,94,0.15)" : result.confidence === "medium" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                        color: result.confidence === "high" ? "#22C55E" : result.confidence === "medium" ? "#F59E0B" : "#EF4444",
                      }}
                    >
                      {result.confidence} confidence
                    </span>
                  </div>

                  {result.favored !== "even" && (
                    <p className="text-xs text-text-muted mb-3">is favored</p>
                  )}

                  <p className="text-sm text-text-secondary leading-relaxed mb-3">{result.favoredReason}</p>

                  {/* Win rate bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={{ color: "#3B82F6" }}>{deckA?.name}</span>
                    <div className="flex-1 flex h-3 rounded-full overflow-hidden gap-0.5">
                      <div
                        className="rounded-full"
                        style={{
                          width: result.favored === "A" ? "60%" : result.favored === "B" ? "40%" : "50%",
                          background: "#3B82F6",
                        }}
                      />
                      <div
                        className="rounded-full"
                        style={{
                          width: result.favored === "B" ? "60%" : result.favored === "A" ? "40%" : "50%",
                          background: "#EF4444",
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold" style={{ color: "#EF4444" }}>{deckBName}</span>
                  </div>
                  <p className="text-[10px] text-text-muted text-center mt-1">{result.estimatedWinRate}</p>
                </div>
              </div>

              {/* Key Interactions */}
              {result.keyInteractions?.length > 0 && (
                <div className="glass-card rounded-2xl border border-border p-4">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Key Interactions</h3>
                  <div className="space-y-2">
                    {result.keyInteractions.map((ki, i) => (
                      <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                          style={{
                            background: ki.advantage === "A" ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
                            color: ki.advantage === "A" ? "#3B82F6" : "#EF4444",
                          }}
                        >
                          {ki.advantage}
                        </span>
                        <p className="text-xs text-text-secondary leading-relaxed">{ki.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Deck A */}
                <div className="glass-card rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>A</span>
                    <span className="text-xs font-semibold text-text-primary truncate">{deckA?.name}</span>
                  </div>
                  {result.deckAStrengths?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-legal uppercase tracking-wider font-semibold mb-1">Strengths</p>
                      {result.deckAStrengths.map((s, i) => (
                        <p key={i} className="text-[11px] text-text-muted leading-relaxed flex items-start gap-1">
                          <span className="text-legal mt-0.5">+</span> {s}
                        </p>
                      ))}
                    </div>
                  )}
                  {result.deckAWeaknesses?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-banned uppercase tracking-wider font-semibold mb-1">Weaknesses</p>
                      {result.deckAWeaknesses.map((w, i) => (
                        <p key={i} className="text-[11px] text-text-muted leading-relaxed flex items-start gap-1">
                          <span className="text-banned mt-0.5">-</span> {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deck B */}
                <div className="glass-card rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>B</span>
                    <span className="text-xs font-semibold text-text-primary truncate">{deckBName}</span>
                  </div>
                  {result.deckBStrengths?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-legal uppercase tracking-wider font-semibold mb-1">Strengths</p>
                      {result.deckBStrengths.map((s, i) => (
                        <p key={i} className="text-[11px] text-text-muted leading-relaxed flex items-start gap-1">
                          <span className="text-legal mt-0.5">+</span> {s}
                        </p>
                      ))}
                    </div>
                  )}
                  {result.deckBWeaknesses?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-banned uppercase tracking-wider font-semibold mb-1">Weaknesses</p>
                      {result.deckBWeaknesses.map((w, i) => (
                        <p key={i} className="text-[11px] text-text-muted leading-relaxed flex items-start gap-1">
                          <span className="text-banned mt-0.5">-</span> {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Piloting Advice */}
              <div className="glass-card rounded-2xl border border-border p-4">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Piloting Advice</h3>
                <div className="space-y-3">
                  <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#3B82F6" }}>As {deckA?.name}</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{result.pilotingAdviceA}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#EF4444" }}>As {deckBName}</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{result.pilotingAdviceB}</p>
                  </div>
                </div>
              </div>

              {/* Swing Cards */}
              {result.swingCards?.length > 0 && (
                <div className="glass-card rounded-2xl border border-border p-4">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Swing Cards</h3>
                  <div className="space-y-2">
                    {result.swingCards.map((sc, i) => (
                      <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                          style={{
                            background: sc.deck === "A" ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
                            color: sc.deck === "A" ? "#3B82F6" : "#EF4444",
                          }}
                        >
                          {sc.deck}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-text-primary">{sc.card}</p>
                          <p className="text-[11px] text-text-muted leading-relaxed">{sc.impact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-analyze */}
              <button
                onClick={analyze}
                disabled={loading}
                className="text-xs text-text-muted hover:text-accent transition-colors py-1"
              >
                Re-analyze matchup
              </button>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}

export default function MatchupPage() {
  return (
    <Suspense>
      <MatchupPageInner />
    </Suspense>
  );
}
