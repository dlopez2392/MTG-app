"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";

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
            <p className="text-3xl font-black tracking-[0.3em] text-accent">{roomCode}</p>
          </div>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl active:scale-95 transition-all"
          >
            Leave
          </button>
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
