"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import { usePlaygroup } from "@/hooks/usePlaygroup";
import { useDecks } from "@/hooks/useDecks";
import type { PlaygroupMember } from "@/types/playgroup";

const BRACKET_STYLES: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: "#22C55E", bg: "rgba(34,197,94,0.15)", label: "Casual" },
  2: { color: "#3B82F6", bg: "rgba(59,130,246,0.15)", label: "Focused" },
  3: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Optimized" },
  4: { color: "#EF4444", bg: "rgba(239,68,68,0.15)", label: "Competitive" },
};

const AVATAR_COLORS = [
  "#607D8B", "#2E7D32", "#00838F", "#1565C0", "#6A1B9A",
  "#C62828", "#E65100", "#F9A825", "#AD1457", "#4E342E",
];

interface PlayerEntry {
  id: string;
  name: string;
  avatarColor: string;
  bracket: number;
  deckName?: string;
  isGuest?: boolean;
}

interface Pod {
  players: PlayerEntry[];
  avgBracket: number;
  spread: number;
}

function organizePods(players: PlayerEntry[]): Pod[] {
  if (players.length < 2) return [];

  const sorted = [...players].sort((a, b) => a.bracket - b.bracket);
  const pods: Pod[] = [];
  const podSize = 4;

  if (sorted.length <= podSize) {
    const avg = sorted.reduce((s, p) => s + p.bracket, 0) / sorted.length;
    const spread = Math.max(...sorted.map((p) => p.bracket)) - Math.min(...sorted.map((p) => p.bracket));
    pods.push({ players: sorted, avgBracket: avg, spread });
    return pods;
  }

  const numPods = Math.max(1, Math.round(sorted.length / podSize));
  const podBuckets: PlayerEntry[][] = Array.from({ length: numPods }, () => []);

  // Snake-draft assignment for balanced bracket distribution
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / numPods);
    const idx = round % 2 === 0 ? i % numPods : numPods - 1 - (i % numPods);
    podBuckets[idx].push(sorted[i]);
  }

  for (const bucket of podBuckets) {
    if (bucket.length === 0) continue;
    const avg = bucket.reduce((s, p) => s + p.bracket, 0) / bucket.length;
    const spread = bucket.length > 1
      ? Math.max(...bucket.map((p) => p.bracket)) - Math.min(...bucket.map((p) => p.bracket))
      : 0;
    pods.push({ players: bucket, avgBracket: avg, spread });
  }

  return pods;
}

function BracketPill({ bracket }: { bracket: number }) {
  const s = BRACKET_STYLES[bracket] ?? BRACKET_STYLES[1];
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black"
      style={{ background: s.bg, color: s.color }}
    >
      {bracket}
    </span>
  );
}

export default function PodOrganizerPage() {
  const router = useRouter();
  const { members } = usePlaygroup();
  const { allDecks: decks } = useDecks();

  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [playerBrackets, setPlayerBrackets] = useState<Record<string, number>>({});
  const [playerDecks, setPlayerDecks] = useState<Record<string, string>>({});
  const [guestName, setGuestName] = useState("");
  const [guests, setGuests] = useState<PlayerEntry[]>([]);
  const [guestBracket, setGuestBracket] = useState(2);
  const [pods, setPods] = useState<Pod[]>([]);
  const [showResults, setShowResults] = useState(false);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowResults(false);
  }

  function setBracket(id: string, bracket: number) {
    setPlayerBrackets((prev) => ({ ...prev, [id]: bracket }));
    setShowResults(false);
  }

  function setDeck(id: string, deckId: string) {
    setPlayerDecks((prev) => ({ ...prev, [id]: deckId }));
    setShowResults(false);
  }

  function addGuest() {
    if (!guestName.trim()) return;
    const id = `guest-${Date.now()}`;
    setGuests((prev) => [
      ...prev,
      {
        id,
        name: guestName.trim(),
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        bracket: guestBracket,
        isGuest: true,
      },
    ]);
    setGuestName("");
    setGuestBracket(2);
    setShowResults(false);
  }

  function removeGuest(id: string) {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    setShowResults(false);
  }

  function buildPlayers(): PlayerEntry[] {
    const players: PlayerEntry[] = [];

    for (const m of members) {
      if (!selectedMembers.has(m.id)) continue;
      const deckId = playerDecks[m.id];
      const deck = deckId ? decks.find((d) => d.id === deckId) : undefined;
      players.push({
        id: m.id,
        name: m.name,
        avatarColor: m.avatarColor ?? AVATAR_COLORS[0],
        bracket: playerBrackets[m.id] ?? 2,
        deckName: deck?.name,
      });
    }

    for (const g of guests) {
      players.push(g);
    }

    return players;
  }

  function generatePods() {
    const players = buildPlayers();
    if (players.length < 2) return;
    const result = organizePods(players);
    setPods(result);
    setShowResults(true);
  }

  function shuffle() {
    const players = buildPlayers();
    if (players.length < 2) return;
    // Shuffle within same bracket bands for variety
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    const result = organizePods(players);
    setPods(result);
    setShowResults(true);
  }

  const totalPlayers = selectedMembers.size + guests.length;

  const ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Pod Organizer"
        subtitle="Build balanced pods for Commander night"
        accent="#F59E0B"
        icon={ICON}
        onBack={() => router.back()}
      />

      <PageContainer>
        <div className="flex flex-col gap-4 max-w-2xl pb-8">

          {/* Step 1: Select Players */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              1. Select Players ({totalPlayers} selected)
            </h3>

            {members.length === 0 ? (
              <p className="text-sm text-text-muted py-2">No playgroup members yet — add some on the Playgroup page or use guest slots below.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {members.map((m) => {
                  const selected = selectedMembers.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMember(m.id)}
                      className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                      style={{
                        background: selected ? "rgba(124,92,252,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selected ? "rgba(124,92,252,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: m.avatarColor ?? AVATAR_COLORS[0] }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-text-primary flex-1 text-left truncate">{m.name}</span>
                      <div
                        className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: selected ? "#7C5CFC" : "rgba(255,255,255,0.15)",
                          background: selected ? "#7C5CFC" : "transparent",
                        }}
                      >
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Add guest */}
            <div className="border-t border-border pt-3 mt-1">
              <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium mb-2">Add Guest Player</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest name"
                  className="input-base flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") addGuest(); }}
                />
                <select
                  value={guestBracket}
                  onChange={(e) => setGuestBracket(Number(e.target.value))}
                  className="rounded-xl px-2 py-2 text-sm text-white/80 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", width: "5rem" }}
                >
                  <option value={1}>B1</option>
                  <option value={2}>B2</option>
                  <option value={3}>B3</option>
                  <option value={4}>B4</option>
                </select>
                <button
                  onClick={addGuest}
                  disabled={!guestName.trim()}
                  className="px-3 py-2 rounded-xl btn-gradient text-sm font-bold disabled:opacity-40"
                >
                  Add
                </button>
              </div>

              {guests.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {guests.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg"
                      style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}
                    >
                      <span className="text-xs text-text-primary">{g.name}</span>
                      <BracketPill bracket={g.bracket} />
                      <button
                        onClick={() => removeGuest(g.id)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10"
                      >
                        <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Set Bracket / Deck for selected members */}
          {selectedMembers.size > 0 && (
            <div className="glass-card rounded-2xl border border-border p-4">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                2. Set Bracket Level
              </h3>
              <p className="text-[11px] text-text-muted mb-3">Pick a deck for auto-bracket, or set manually.</p>

              <div className="flex flex-col gap-2.5">
                {members
                  .filter((m) => selectedMembers.has(m.id))
                  .map((m) => {
                    const currentBracket = playerBrackets[m.id] ?? 2;
                    const selectedDeck = playerDecks[m.id];
                    const bs = BRACKET_STYLES[currentBracket];

                    return (
                      <div
                        key={m.id}
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: m.avatarColor ?? AVATAR_COLORS[0] }}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-text-primary flex-1 truncate">{m.name}</span>
                          <BracketPill bracket={currentBracket} />
                        </div>

                        <div className="flex gap-2">
                          {/* Deck selector */}
                          <select
                            value={selectedDeck ?? ""}
                            onChange={(e) => {
                              const dId = e.target.value;
                              setDeck(m.id, dId);
                            }}
                            className="flex-1 rounded-lg px-2 py-1.5 text-xs text-white/70 appearance-none cursor-pointer [&>option]:text-black [&>option]:bg-white truncate"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            <option value="">No deck (manual)</option>
                            {decks.map((d) => (
                              <option key={d.id} value={d.id ?? ""}>{d.name}</option>
                            ))}
                          </select>

                          {/* Manual bracket buttons */}
                          {!selectedDeck && (
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((b) => (
                                <button
                                  key={b}
                                  onClick={() => setBracket(m.id, b)}
                                  className="w-7 h-7 rounded-lg text-xs font-black transition-all"
                                  style={{
                                    background: currentBracket === b ? BRACKET_STYLES[b].bg : "rgba(255,255,255,0.03)",
                                    color: currentBracket === b ? BRACKET_STYLES[b].color : "rgba(255,255,255,0.25)",
                                    border: `1px solid ${currentBracket === b ? BRACKET_STYLES[b].color + "40" : "rgba(255,255,255,0.06)"}`,
                                  }}
                                >
                                  {b}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Generate button */}
          {totalPlayers >= 2 && (
            <div className="flex gap-2">
              <button
                onClick={generatePods}
                className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "white",
                  boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                  Generate Pods
                </span>
              </button>
              {showResults && (
                <button
                  onClick={shuffle}
                  className="px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {totalPlayers > 0 && totalPlayers < 2 && (
            <p className="text-xs text-text-muted text-center py-2">Select at least 2 players to generate pods</p>
          )}

          {/* Pod results */}
          {showResults && pods.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Generated Pods ({pods.length} {pods.length === 1 ? "pod" : "pods"})
              </h3>

              {pods.map((pod, podIdx) => {
                const bs = BRACKET_STYLES[Math.round(pod.avgBracket)] ?? BRACKET_STYLES[2];
                const balanceLabel = pod.spread === 0 ? "Perfect" : pod.spread === 1 ? "Good" : pod.spread === 2 ? "Fair" : "Wide";
                const balanceColor = pod.spread === 0 ? "#22C55E" : pod.spread === 1 ? "#3B82F6" : pod.spread === 2 ? "#F59E0B" : "#EF4444";

                return (
                  <div
                    key={podIdx}
                    className="rounded-2xl p-[1px] overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${bs.color}50, ${bs.color}15)` }}
                  >
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: "linear-gradient(135deg, rgba(20,20,30,0.9), rgba(15,15,25,0.95))",
                        boxShadow: `inset 0 0 24px ${bs.bg}`,
                      }}
                    >
                      {/* Pod header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white/80">Pod {podIdx + 1}</span>
                          <span className="text-[10px] text-white/30">·</span>
                          <span className="text-xs text-white/40">{pod.players.length} players</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: `${balanceColor}20`, color: balanceColor }}
                          >
                            {balanceLabel} balance
                          </span>
                          <span className="text-xs text-white/30">
                            Avg B{pod.avgBracket.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* Players */}
                      <div className="flex flex-col gap-1.5">
                        {pod.players.map((player) => {
                          const pbs = BRACKET_STYLES[player.bracket] ?? BRACKET_STYLES[2];
                          return (
                            <div
                              key={player.id}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                              style={{ background: "rgba(255,255,255,0.03)" }}
                            >
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: player.avatarColor }}
                              >
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm text-white/80 flex-1 truncate">
                                {player.name}
                                {player.isGuest && <span className="text-[10px] text-white/25 ml-1">(guest)</span>}
                              </span>
                              {player.deckName && (
                                <span className="text-[10px] text-white/30 truncate max-w-[100px]">{player.deckName}</span>
                              )}
                              <BracketPill bracket={player.bracket} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Balance summary */}
              <div className="glass-card rounded-2xl border border-border p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Balance Summary</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary">{pods.length}</p>
                    <p className="text-[10px] text-text-muted uppercase">Pods</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary">{totalPlayers}</p>
                    <p className="text-[10px] text-text-muted uppercase">Players</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: pods.every((p) => p.spread <= 1) ? "#22C55E" : "#F59E0B" }}>
                      {pods.every((p) => p.spread <= 1) ? "Balanced" : "Mixed"}
                    </p>
                    <p className="text-[10px] text-text-muted uppercase">Quality</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bracket guide */}
          <div className="glass-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Bracket Guide</h3>
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((b) => {
                const bs = BRACKET_STYLES[b];
                const descriptions: Record<number, string> = {
                  1: "Precons, casual builds, low interaction. Games go long with big splashy plays.",
                  2: "Upgraded precons, clear strategy, some tutors. Purposeful but not cutthroat.",
                  3: "Efficient mana, strong combos, high interaction. Games close by turn 8-10.",
                  4: "cEDH. Fast mana, infinite combos, stax, MLD. Wins as early as possible.",
                };
                return (
                  <div
                    key={b}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-xl"
                    style={{ background: `${bs.bg}` }}
                  >
                    <BracketPill bracket={b} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: bs.color }}>{bs.label}</p>
                      <p className="text-[11px] text-white/40 leading-relaxed">{descriptions[b]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
