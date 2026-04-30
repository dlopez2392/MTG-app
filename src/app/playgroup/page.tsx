"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { usePlaygroup } from "@/hooks/usePlaygroup";
import { useGameLog } from "@/hooks/useGameLog";
import { useMatchHistory } from "@/hooks/useMatchHistory";
import { cn } from "@/lib/utils/cn";
import { computeDeckMatchups } from "@/lib/utils/matchupStats";
import type { PlaygroupMember } from "@/types/playgroup";

interface FriendDeck {
  id: string;
  name: string;
  format: string | null;
  coverImageUri: string | null;
  cardCount: number;
  updatedAt: string;
}

const AVATAR_COLORS = [
  "#607D8B", "#2E7D32", "#00838F", "#1565C0", "#6A1B9A",
  "#C62828", "#E65100", "#F9A825", "#AD1457", "#4E342E",
];

interface MemberStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  lastPlayed?: string;
  formats: Record<string, number>;
}

function computeMemberStats(
  memberName: string,
  gameEntries: { opponentNames?: string; result: string; date: string; format?: string }[],
  matches: { players: { playerName: string; isWinner: boolean }[]; format: string | null; createdAt: string }[],
): MemberStats {
  const stats: MemberStats = { gamesPlayed: 0, wins: 0, losses: 0, formats: {} };
  const nameLower = memberName.toLowerCase();

  for (const entry of gameEntries) {
    if (!entry.opponentNames) continue;
    const opponents = entry.opponentNames.split(",").map((n) => n.trim().toLowerCase());
    if (opponents.includes(nameLower)) {
      stats.gamesPlayed++;
      if (entry.result === "win") stats.wins++;
      if (entry.result === "loss") stats.losses++;
      if (entry.format) stats.formats[entry.format] = (stats.formats[entry.format] ?? 0) + 1;
      if (!stats.lastPlayed || entry.date > stats.lastPlayed) stats.lastPlayed = entry.date;
    }
  }

  for (const match of matches) {
    const hasPlayer = match.players.some((p) => p.playerName.toLowerCase() === nameLower);
    if (hasPlayer) {
      stats.gamesPlayed++;
      const winner = match.players.find((p) => p.isWinner);
      if (winner && winner.playerName.toLowerCase() !== nameLower) stats.wins++;
      if (winner && winner.playerName.toLowerCase() === nameLower) stats.losses++;
      if (match.format) stats.formats[match.format] = (stats.formats[match.format] ?? 0) + 1;
      const d = match.createdAt;
      if (!stats.lastPlayed || d > stats.lastPlayed) stats.lastPlayed = d;
    }
  }

  return stats;
}

interface FoundUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

function MemberForm({
  initial,
  onSave,
  onCancel,
  saveLabel = "Add",
  isEditing = false,
}: {
  initial?: Partial<PlaygroupMember>;
  onSave: (name: string, color: string, notes?: string, friendUserId?: string) => void;
  onCancel: () => void;
  saveLabel?: string;
  isEditing?: boolean;
}) {
  const [tab, setTab] = useState<"search" | "manual">(isEditing ? "manual" : "search");
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.avatarColor ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ found: boolean; user?: FoundUser } | null>(null);

  async function handleSearch() {
    if (!email.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/profile/search?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      setSearchResult(data);
      if (data.found && data.user) {
        setName(data.user.displayName);
      }
    } catch {
      setSearchResult({ found: false });
    } finally {
      setSearching(false);
    }
  }

  const foundUser = searchResult?.found ? searchResult.user : null;

  return (
    <div className="space-y-4">
      {/* Tab toggle — only show for new members */}
      {!isEditing && (
        <div className="flex gap-1 bg-bg-card rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => { setTab("search"); setSearchResult(null); }}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-semibold rounded transition-colors",
              tab === "search" ? "btn-gradient" : "text-text-muted hover:text-text-secondary"
            )}
          >
            Find by Email
          </button>
          <button
            type="button"
            onClick={() => { setTab("manual"); setSearchResult(null); }}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-semibold rounded transition-colors",
              tab === "manual" ? "btn-gradient" : "text-text-muted hover:text-text-secondary"
            )}
          >
            Add Manually
          </button>
        </div>
      )}

      {/* Search by email */}
      {tab === "search" && !isEditing && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Email Address</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSearchResult(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="friend@example.com"
                className="flex-1 input-base px-3 py-2.5"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={!email.trim() || searching}
                className="px-4 py-2 rounded-xl btn-gradient text-sm font-bold transition-colors disabled:opacity-40"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>
          </div>

          {searchResult && !searchResult.found && (
            <div className="rounded-xl px-4 py-3 bg-bg-card border border-border">
              <p className="text-sm text-text-secondary">No discoverable account found for this email.</p>
              <p className="text-xs text-text-muted mt-1">They may need to enable &quot;Discoverable&quot; in their settings, or you can add them manually.</p>
            </div>
          )}

          {foundUser && (
            <div className="rounded-xl px-4 py-3 bg-accent/10 border border-accent/30">
              <div className="flex items-center gap-3">
                {foundUser.avatarUrl ? (
                  <img src={foundUser.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                    {foundUser.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{foundUser.displayName}</p>
                  <p className="text-xs text-accent">Account linked</p>
                </div>
                <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual name — always show in manual tab or when editing, also show after successful search */}
      {(tab === "manual" || isEditing || foundUser) && (
        <>
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name..."
              className="w-full input-base px-3 py-2.5"
              autoFocus={tab === "manual" || isEditing}
            />
          </div>

          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color === c ? "ring-2 ring-white ring-offset-2 ring-offset-bg-primary scale-110" : "opacity-60 hover:opacity-90"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Notes <span className="text-text-muted/60">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Favorite commanders, play style..."
              rows={2}
              className="w-full input-base px-3 py-2.5 resize-none"
            />
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => name.trim() && onSave(name.trim(), color, notes.trim() || undefined, foundUser?.userId)}
          disabled={!name.trim()}
          className="px-4 py-2 rounded-xl btn-gradient text-sm font-bold transition-colors disabled:opacity-40"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-lg font-bold tabular-nums", color ?? "text-text-primary")}>{value}</p>
      <p className="text-[10px] text-text-muted">{label}</p>
    </div>
  );
}

function WinRateBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5 w-full">
      {wPct > 0 && <div className="bg-legal rounded-full" style={{ width: `${wPct}%` }} />}
      {100 - wPct > 0 && <div className="bg-banned rounded-full" style={{ width: `${100 - wPct}%` }} />}
    </div>
  );
}

function FriendDecksList({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [decks, setDecks] = useState<FriendDeck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/playgroup/${memberId}/decks`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDecks(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memberId]);

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-bg-hover rounded-lg skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4 text-center">
        {memberName} hasn&apos;t shared any public decks yet.
      </p>
    );
  }

  return (
    <div className="space-y-2 py-1">
      {decks.map((deck) => (
        <div key={deck.id} className="flex items-center gap-3 p-3 bg-bg-card rounded-xl border border-border">
          {deck.coverImageUri ? (
            <img
              src={deck.coverImageUri}
              alt=""
              className="w-10 h-14 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-14 rounded bg-bg-hover flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-1.243 1.007-2.25 2.25-2.25h13.5z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{deck.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {deck.format && (
                <span className="text-[10px] bg-accent/10 text-accent/80 px-1.5 py-0.5 rounded font-medium capitalize">
                  {deck.format}
                </span>
              )}
              <span className="text-xs text-text-muted">{deck.cardCount} cards</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlaygroupPage() {
  const router = useRouter();
  const { members, loading, addMember, updateMember, deleteMember } = usePlaygroup();
  const { entries } = useGameLog();
  const { matches } = useMatchHistory();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PlaygroupMember | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewingDecks, setViewingDecks] = useState<PlaygroupMember | null>(null);

  const memberStats = useMemo(() => {
    const map = new Map<string, MemberStats>();
    for (const m of members) {
      map.set(m.id, computeMemberStats(m.name, entries, matches));
    }
    return map;
  }, [members, entries, matches]);

  const totalGames = entries.length + matches.length;

  const ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );

  return (
    <>
      <HeroBanner
        title="Playgroup"
        subtitle={members.length > 0 ? `${members.length} members · ${totalGames} games` : "Track your regular opponents"}
        accent="#22C55E"
        icon={ICON}
        onBack={() => router.back()}
      />

      <PageContainer>
        {/* Quick actions row */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={() => router.push("/playgroup/stores")}
            className="rounded-2xl border border-accent/30 p-3 flex items-center gap-2.5 transition-all active:scale-[0.98] hover:border-accent/50"
            style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.12), rgba(124,92,252,0.04))" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(124,92,252,0.2)" }}
            >
              <svg className="w-4.5 h-4.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-text-primary">Find a Store</p>
              <p className="text-[10px] text-text-muted">LGS &amp; events nearby</p>
            </div>
          </button>
          <button
            onClick={() => router.push("/playgroup/pods")}
            className="rounded-2xl border p-3 flex items-center gap-2.5 transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))",
              borderColor: "rgba(245,158,11,0.3)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(245,158,11,0.2)" }}
            >
              <svg className="w-4.5 h-4.5" style={{ color: "#F59E0B" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-text-primary">Pod Organizer</p>
              <p className="text-[10px] text-text-muted">Balance by bracket</p>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-text-muted">{members.length} {members.length === 1 ? "member" : "members"}</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl btn-gradient text-sm font-bold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Member
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-bg-card rounded-xl border border-border skeleton-shimmer" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            }
            title="No playgroup members yet"
            description="Add the people you regularly play with to track matchups and stats over time."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const stats = memberStats.get(member.id);
              const isExpanded = expanded === member.id;
              const winRate = stats && stats.gamesPlayed > 0
                ? Math.round((stats.wins / stats.gamesPlayed) * 100)
                : null;
              const topFormat = stats ? Object.entries(stats.formats).sort((a, b) => b[1] - a[1])[0] : undefined;

              return (
                <div key={member.id} className="bg-bg-card rounded-xl border border-border overflow-hidden">
                  {/* Main row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : member.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="relative flex-shrink-0">
                      {member.friendAvatarUrl ? (
                        <img src={member.friendAvatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: member.avatarColor }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {member.friendUserId && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{member.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {stats && stats.gamesPlayed > 0 ? (
                          <>
                            <span className="text-xs text-text-muted">{stats.gamesPlayed} games</span>
                            {winRate !== null && (
                              <span className={cn(
                                "text-xs font-semibold tabular-nums",
                                winRate >= 60 ? "text-legal" : winRate >= 40 ? "text-accent" : "text-banned"
                              )}>
                                {winRate}% WR
                              </span>
                            )}
                            {topFormat && (
                              <span className="text-[9px] bg-bg-hover px-1.5 py-0.5 rounded text-text-muted uppercase font-bold tracking-wide">
                                {topFormat[0]}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-text-muted">No games yet</span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={cn("w-4 h-4 text-text-muted transition-transform flex-shrink-0", isExpanded && "rotate-180")}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border">
                      {stats && stats.gamesPlayed > 0 ? (
                        <div className="pt-3 space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            <StatBadge label="Games" value={stats.gamesPlayed} />
                            <StatBadge label="Your Wins" value={stats.wins} color="text-legal" />
                            <StatBadge label="Their Wins" value={stats.losses} color="text-banned" />
                            <StatBadge label="Win Rate" value={winRate !== null ? `${winRate}%` : "—"} color={
                              winRate !== null ? (winRate >= 60 ? "text-legal" : winRate >= 40 ? "text-accent" : "text-banned") : undefined
                            } />
                          </div>
                          <WinRateBar wins={stats.wins} losses={stats.losses} />
                          {stats.lastPlayed && (
                            <p className="text-xs text-text-muted">
                              Last played: {new Date(stats.lastPlayed).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                          {Object.keys(stats.formats).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(stats.formats).sort((a, b) => b[1] - a[1]).map(([fmt, count]) => (
                                <span key={fmt} className="text-[10px] bg-accent/10 text-accent/80 px-2 py-0.5 rounded font-medium capitalize">
                                  {fmt} ({count})
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Deck matchup breakdown */}
                          {(() => {
                            const matchups = computeDeckMatchups(entries, member.name);
                            if (matchups.byDeck.length === 0) return null;
                            return (
                              <div className="pt-1">
                                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1.5">Deck Matchups</p>
                                <div className="space-y-1">
                                  {matchups.byDeck.slice(0, 5).map((d) => (
                                    <div key={d.deckName} className="flex items-center gap-2 text-xs">
                                      <span className="flex-1 truncate text-text-secondary font-medium">{d.deckName}</span>
                                      <span className="text-legal tabular-nums font-semibold">{d.wins}W</span>
                                      <span className="text-banned tabular-nums font-semibold">{d.losses}L</span>
                                      <span className={cn(
                                        "tabular-nums font-bold text-[11px] w-10 text-right",
                                        d.winRate >= 60 ? "text-legal" : d.winRate >= 40 ? "text-accent" : "text-banned"
                                      )}>
                                        {d.winRate}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted pt-3">
                          Play some games with {member.name} to see head-to-head stats here.
                        </p>
                      )}

                      {member.notes && (
                        <p className="text-xs text-text-secondary mt-2 italic">{member.notes}</p>
                      )}

                      <div className="flex gap-2 mt-3">
                        {member.friendUserId && (
                          <button
                            onClick={() => setViewingDecks(member)}
                            className="flex-1 py-2 rounded-lg border border-accent/30 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors flex items-center justify-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-1.243 1.007-2.25 2.25-2.25h13.5z" />
                            </svg>
                            View Decks
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(member)}
                          className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { deleteMember(member.id); setExpanded(null); }}
                          className="py-2 px-4 rounded-lg border border-banned/30 text-xs font-semibold text-banned/70 hover:text-banned hover:border-banned/50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>

      {/* Add member modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Member">
        <MemberForm
          onSave={(name, color, notes, friendUserId) => { addMember(name, color, notes, friendUserId); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit member modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Member">
        {editing && (
          <MemberForm
            initial={editing}
            isEditing
            onSave={(name, color, notes) => {
              updateMember(editing.id, { name, avatarColor: color, notes });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            saveLabel="Save"
          />
        )}
      </Modal>

      {/* View friend's decks modal */}
      <Modal open={!!viewingDecks} onClose={() => setViewingDecks(null)} title={`${viewingDecks?.name}'s Decks`}>
        {viewingDecks && (
          <FriendDecksList memberId={viewingDecks.id} memberName={viewingDecks.name} />
        )}
      </Modal>
    </>
  );
}
