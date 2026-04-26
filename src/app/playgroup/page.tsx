"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { usePlaygroup } from "@/hooks/usePlaygroup";
import { useGameLog } from "@/hooks/useGameLog";
import { useMatchHistory } from "@/hooks/useMatchHistory";
import { cn } from "@/lib/utils/cn";
import type { PlaygroupMember } from "@/types/playgroup";

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

function MemberForm({
  initial,
  onSave,
  onCancel,
  saveLabel = "Add",
}: {
  initial?: Partial<PlaygroupMember>;
  onSave: (name: string, color: string, notes?: string) => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.avatarColor ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted font-medium block mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name..."
          className="w-full input-base px-3 py-2.5"
          autoFocus
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

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => name.trim() && onSave(name.trim(), color, notes.trim() || undefined)}
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

export default function PlaygroupPage() {
  const router = useRouter();
  const { members, loading, addMember, updateMember, deleteMember } = usePlaygroup();
  const { entries } = useGameLog();
  const { matches } = useMatchHistory();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PlaygroupMember | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: member.avatarColor }}
                    >
                      {member.name.charAt(0).toUpperCase()}
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
          onSave={(name, color, notes) => { addMember(name, color, notes); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit member modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Member">
        {editing && (
          <MemberForm
            initial={editing}
            onSave={(name, color, notes) => {
              updateMember(editing.id, { name, avatarColor: color, notes });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            saveLabel="Save"
          />
        )}
      </Modal>
    </>
  );
}
