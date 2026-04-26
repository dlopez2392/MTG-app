"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { Player } from "@/types/life";
import type { CreateMatchPayload } from "@/types/match";
import Modal from "@/components/ui/Modal";

interface EndGameModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CreateMatchPayload) => Promise<void>;
  players: Player[];
  startingLife: number;
  gameStartedAt: number;
  durationSecs: number;
  saving?: boolean;
}

export default function EndGameModal({
  open,
  onClose,
  onSave,
  players,
  startingLife,
  gameStartedAt,
  durationSecs,
  saving,
}: EndGameModalProps) {
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const handleSave = async () => {
    const now = new Date().toISOString();
    const payload: CreateMatchPayload = {
      startedAt: new Date(gameStartedAt).toISOString(),
      endedAt: now,
      durationSecs,
      startingLife,
      playerCount: players.length,
      notes: notes.trim() || undefined,
      players: players.map((p, i) => ({
        playerName: p.name,
        color: p.color,
        startingLife,
        finalLife: p.life,
        poisonTotal: p.poisonCounters,
        commanderDmg: Object.values(p.commanderDamage).reduce((a, b) => a + b, 0),
        isWinner: p.id === winnerId,
        playerOrder: i,
      })),
    };
    await onSave(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Match">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Winner
          </label>
          <div className="grid grid-cols-2 gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setWinnerId(winnerId === p.id ? null : p.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer",
                  winnerId === p.id
                    ? "border-accent bg-accent/20 shadow-md"
                    : "border-border bg-bg-card hover:border-accent/40"
                )}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className={cn("text-sm font-semibold truncate", winnerId === p.id ? "text-accent" : "text-text-secondary")}>
                  {p.name}
                </span>
                {winnerId === p.id && (
                  <svg className="w-4 h-4 text-accent ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3v2l4 4-2.5 3.5L3 11v2l4 2 1 6h2l1-6 1.5-2L14 19h2l1-6 4-2v-2l-3.5 1.5L15 7l4-4V1l-5 5-2-2-2 2-5-5z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWinnerId(null)}
            className={cn(
              "mt-2 text-xs text-text-muted hover:text-text-secondary transition-colors",
              !winnerId && "hidden"
            )}
          >
            Clear selection
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Summary
          </label>
          <div className="space-y-1.5">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-bg-card rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-sm text-text-primary font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className={cn("font-bold", p.life <= 0 ? "text-red-400" : "text-text-primary")}>
                    {p.life} HP
                  </span>
                  {p.poisonCounters > 0 && (
                    <span className="text-green-400">{p.poisonCounters} ☠</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How the game went..."
            rows={2}
            className="w-full input-base px-3 py-2 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-bg-card transition-colors cursor-pointer"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl btn-gradient text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Save Match"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
