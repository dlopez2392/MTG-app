"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";
import QrCode from "@/components/ui/QrCode";

interface MultiplayerLobbyProps {
  roomCode: string | null;
  isHost: boolean;
  isConnected: boolean;
  remotePlayers: MultiplayerPlayerState[];
  localPlayer: { name: string; color: string } | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onStartGame: () => void;
}

export default function MultiplayerLobby({
  roomCode,
  isHost,
  isConnected,
  remotePlayers,
  localPlayer,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartGame,
}: MultiplayerLobbyProps) {
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [copied, setCopied] = useState(false);

  const copyRoomCode = useCallback(() => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomCode]);

  if (roomCode && isConnected) {
    const allPlayers = [
      ...(localPlayer ? [{ name: localPlayer.name, color: localPlayer.color, isLocal: true }] : []),
      ...remotePlayers.map((p) => ({ name: p.name, color: p.color, isLocal: false })),
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Room Code</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-black tracking-[0.3em] text-accent">{roomCode}</p>
              <button
                type="button"
                onClick={copyRoomCode}
                className="p-1.5 rounded-lg bg-accent/10 border border-accent/20 active:scale-90 transition-all"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl active:scale-95 transition-all"
          >
            Leave
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <QrCode
            value={`${typeof window !== "undefined" ? window.location.origin : "https://mtghoudini.com"}/life?room=${roomCode}`}
            size={150}
            label={`Join room ${roomCode}`}
          />
          <p className="text-caption">Scan with a phone camera to join</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">
            Players ({allPlayers.length})
          </p>
          {allPlayers.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-card"
            >
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-semibold text-text-primary flex-1">{p.name}</span>
              {p.isLocal && (
                <span className="text-[10px] font-bold text-accent uppercase">You</span>
              )}
            </div>
          ))}
        </div>

        {isHost && (
          <button
            type="button"
            onClick={onStartGame}
            disabled={remotePlayers.length === 0}
            className="w-full py-4 text-sm font-bold rounded-2xl btn-gradient active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Game ({allPlayers.length} players)
          </button>
        )}
        {!isHost && (
          <p className="text-center text-sm text-text-muted">Waiting for host to start...</p>
        )}
      </div>
    );
  }

  if (roomCode && !isConnected) {
    // A room code is set (e.g. auto-joined from a scanned QR link) but the
    // realtime channel hasn't confirmed the subscription yet — show a
    // connecting state instead of falling through to the idle Create/Join
    // screen, which would otherwise hide that a join is in progress.
    return (
      <div className="space-y-3 text-center py-6">
        <p className="text-sm font-bold text-text-primary tracking-[0.2em] uppercase">
          {isHost ? "Creating room…" : `Joining ${roomCode}…`}
        </p>
        <p className="text-xs text-text-muted">Connecting to the room</p>
        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-full py-3 text-sm font-bold rounded-xl border border-border text-text-secondary active:scale-95 transition-all"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { setMode("create"); onCreateRoom(); }}
          className="w-full py-4 text-sm font-bold rounded-2xl btn-gradient active:scale-[0.98] transition-all"
        >
          Create Room
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className="w-full py-4 text-sm font-bold rounded-2xl border border-accent/30 text-accent active:scale-[0.98] transition-all"
        >
          Join Room
        </button>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="ENTER CODE"
            maxLength={5}
            className="flex-1 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] uppercase rounded-xl border border-border bg-bg-card text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setMode("idle"); setJoinCode(""); }}
            className="flex-1 py-3 text-sm font-bold rounded-xl border border-border text-text-secondary active:scale-95 transition-all"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => { if (joinCode.length === 5) onJoinRoom(joinCode); }}
            disabled={joinCode.length !== 5}
            className="flex-1 py-3 text-sm font-bold rounded-xl btn-gradient active:scale-95 transition-all disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  return null;
}
