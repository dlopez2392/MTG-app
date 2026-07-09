"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS, DEFAULT_PLAYER_COLOR_KEYS, type MtgPlayerColorKey } from "@/lib/constants";
import Input from "@/components/ui/Input";
import ManaSymbol from "@/components/cards/ManaSymbol";
import type { PlaygroupMember } from "@/types/playgroup";
import MultiplayerLobby from "@/components/life/MultiplayerLobby";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";

export type LayoutId = string;

export interface LayoutOption {
  id: LayoutId;
  panels: { x: number; y: number; w: number; h: number; rotated?: boolean }[];
}

export const LAYOUTS: Record<number, LayoutOption[]> = {
  1: [
    { id: "1-full", panels: [{ x: 0, y: 0, w: 1, h: 1 }] },
  ],
  2: [
    { id: "2-stack", panels: [{ x: 0, y: 0, w: 1, h: 0.5, rotated: true }, { x: 0, y: 0.5, w: 1, h: 0.5 }] },
  ],
  3: [
    { id: "3-top1-bot2", panels: [{ x: 0, y: 0, w: 1, h: 0.5, rotated: true }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  ],
  4: [
    { id: "4-grid", panels: [{ x: 0, y: 0, w: 0.5, h: 0.5, rotated: true }, { x: 0.5, y: 0, w: 0.5, h: 0.5, rotated: true }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  ],
  5: [
    { id: "5-2-2-1", panels: [{ x: 0, y: 0, w: 0.5, h: 0.33, rotated: true }, { x: 0.5, y: 0, w: 0.5, h: 0.33, rotated: true }, { x: 0, y: 0.33, w: 0.5, h: 0.34 }, { x: 0.5, y: 0.33, w: 0.5, h: 0.34 }, { x: 0, y: 0.67, w: 1, h: 0.33 }] },
  ],
  6: [
    { id: "6-grid", panels: [{ x: 0, y: 0, w: 0.5, h: 0.33, rotated: true }, { x: 0.5, y: 0, w: 0.5, h: 0.33, rotated: true }, { x: 0, y: 0.33, w: 0.5, h: 0.34 }, { x: 0.5, y: 0.33, w: 0.5, h: 0.34 }, { x: 0, y: 0.67, w: 0.5, h: 0.33 }, { x: 0.5, y: 0.67, w: 0.5, h: 0.33 }] },
  ],
};

/** Compute the rotation angle (degrees) so panel content faces outward toward the nearest screen edge. */
export function getOutwardRotation(panel: { x: number; y: number; w: number; h: number }): number {
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;
  if (panel.w >= 0.9) return cy < 0.5 ? 180 : 0;
  if (panel.h >= 0.9) return cx < 0.5 ? 90 : -90;
  return cx < 0.5 ? 90 : -90;
}

export interface GameOptions {
  poisonCounters: boolean;
  turnTimer: boolean;
  gameTimer: boolean;
  gameTimerMinutes: number;
  layout: LayoutId;
}

interface PlayerSetupProps {
  defaultPlayerCount?: number;
  defaultStartingLife?: number;
  onStart: (
    playerCount: number,
    startingLife: number,
    playerNames: string[],
    playerColors: string[],
    options: GameOptions
  ) => void;
  onShowMatchHistory?: () => void;
  playgroupMembers?: PlaygroupMember[];
  multiplayerRoom?: {
    roomCode: string | null;
    isHost: boolean;
    isConnected: boolean;
    remotePlayers: MultiplayerPlayerState[];
    onCreateRoom: () => void;
    onJoinRoom: (code: string) => void;
    onLeaveRoom: () => void;
    onStartGame: () => void;
  };
}

const LIFE_TOTALS = [20, 25, 30, 40] as const;

const PLAYER_COLORS = [
  { base: "#607D8B", light: "#90A4AE", dark: "#37474F" },
  { base: "#2E7D32", light: "#66BB6A", dark: "#1B5E20" },
  { base: "#00838F", light: "#26C6DA", dark: "#004D40" },
  { base: "#1565C0", light: "#42A5F5", dark: "#0D47A1" },
  { base: "#6A1B9A", light: "#AB47BC", dark: "#4A148C" },
  { base: "#C62828", light: "#EF5350", dark: "#8E0000" },
];

export default function PlayerSetup({
  defaultPlayerCount = 2,
  defaultStartingLife = 20,
  onStart,
  onShowMatchHistory,
  playgroupMembers = [],
  multiplayerRoom,
}: PlayerSetupProps) {
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount);
  const [startingLife, setStartingLife] = useState(defaultStartingLife);
  const [customLife, setCustomLife] = useState(!LIFE_TOTALS.includes(defaultStartingLife as typeof LIFE_TOTALS[number]));
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 6 }, (_, i) => `Player ${i + 1}`)
  );
  const [selectedColorKeys, setSelectedColorKeys] = useState<MtgPlayerColorKey[]>(
    [...DEFAULT_PLAYER_COLOR_KEYS]
  );

  const [turnTimer, setTurnTimer] = useState(false);
  const [gameTimer, setGameTimer] = useState(false);
  const [gameTimerMinutes, setGameTimerMinutes] = useState(90);

  function handleNameChange(index: number, name: string) {
    setPlayerNames((prev) => { const next = [...prev]; next[index] = name; return next; });
  }

  function handleColorChange(playerIndex: number, key: MtgPlayerColorKey) {
    setSelectedColorKeys((prev) => { const next = [...prev] as MtgPlayerColorKey[]; next[playerIndex] = key; return next; });
  }

  function handleStart() {
    const names = playerNames.slice(0, playerCount);
    const colors = selectedColorKeys
      .slice(0, playerCount)
      .map((k) => MTG_PLAYER_COLORS.find((c) => c.key === k)!.color);
    onStart(playerCount, startingLife, names, colors, {
      poisonCounters: false,
      turnTimer,
      gameTimer,
      gameTimerMinutes,
      layout: LAYOUTS[playerCount]?.[0]?.id ?? "2-stack",
    });
  }

  return (
    <div className="flex flex-col min-h-screen overflow-y-auto pb-24 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-text-primary">
          Life Counter
        </h1>
        {onShowMatchHistory && (
          <button
            type="button"
            onClick={onShowMatchHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-card border border-border text-text-muted hover:text-text-primary hover:border-accent/40 transition-all text-xs font-semibold cursor-pointer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 3v2l4 4-2.5 3.5L3 11v2l4 2 1 6h2l1-6 1.5-2L14 19h2l1-6 4-2v-2l-3.5 1.5L15 7l4-4V1l-5 5-2-2-2 2-5-5z" />
            </svg>
            History
          </button>
        )}
      </div>

      <div className="px-6 space-y-5">
        {/* ── Players ── */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Players
          </label>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((count, i) => {
              const c = PLAYER_COLORS[i];
              const isActive = playerCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setPlayerCount(count)}
                  className={cn(
                    "aspect-square rounded-2xl flex items-center justify-center text-2xl font-black text-white cursor-pointer transition-all border-b-4",
                    isActive
                      ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-bg-primary"
                      : "opacity-60 hover:opacity-90 active:scale-95 active:border-b-2 active:translate-y-[2px]"
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${c.light} 0%, ${c.base} 50%, ${c.dark} 100%)`,
                    borderBottomColor: c.dark,
                    boxShadow: isActive
                      ? `0 4px 14px ${c.base}80, inset 0 1px 1px ${c.light}60`
                      : `0 4px 8px ${c.dark}60, inset 0 1px 1px ${c.light}40`,
                  }}
                >
                  <span style={{ textShadow: `0 2px 4px ${c.dark}90` }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Starting Life ── */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Starting Life
          </label>
          <div className="flex gap-2">
            {LIFE_TOTALS.map((life) => (
              <button
                key={life}
                type="button"
                onClick={() => { setStartingLife(life); setCustomLife(false); }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-all border cursor-pointer",
                  !customLife && startingLife === life
                    ? "btn-gradient border-transparent"
                    : "bg-bg-card text-text-secondary border-border hover:border-accent/40"
                )}
              >
                {life}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomLife(true)}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all border cursor-pointer",
                customLife
                  ? "btn-gradient border-transparent"
                  : "bg-bg-card text-text-secondary border-border hover:border-accent/40"
              )}
            >
              Custom
            </button>
          </div>
          {customLife && (
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => setStartingLife((l) => Math.max(1, l - 1))}
                className="w-10 h-10 rounded-xl bg-bg-card border border-border flex items-center justify-center text-text-secondary text-lg font-bold hover:border-accent/40 active:scale-90 transition-all cursor-pointer"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={999}
                value={startingLife}
                onChange={(e) => setStartingLife(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                className="flex-1 input-base px-3 py-2 text-center text-lg font-bold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setStartingLife((l) => Math.min(999, l + 1))}
                className="w-10 h-10 rounded-xl bg-bg-card border border-border flex items-center justify-center text-text-secondary text-lg font-bold hover:border-accent/40 active:scale-90 transition-all cursor-pointer"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* ── Game Options ── */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest">
            Options
          </label>

          {/* Game Timer */}
          <div>
            <button
              type="button"
              onClick={() => {
                const next = !gameTimer;
                setGameTimer(next);
                if (!next) setTurnTimer(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer",
                gameTimer
                  ? "bg-amber-900/30 border-amber-500/50"
                  : "bg-bg-card border-border",
                gameTimer && "rounded-b-none border-b-0"
              )}
            >
              <svg className={cn("w-5 h-5 flex-shrink-0", gameTimer ? "text-amber-400" : "text-text-muted")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 2h4M12 2v2" />
              </svg>
              <span className={cn("text-sm font-semibold flex-1 text-left", gameTimer ? "text-amber-400" : "text-text-secondary")}>
                Game Timer
              </span>
              <div className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                gameTimer ? "bg-amber-500" : "bg-white/10"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  gameTimer ? "translate-x-5" : "translate-x-1"
                )} />
              </div>
            </button>
            {gameTimer && (
              <div className="flex items-center justify-between px-4 py-3 bg-amber-900/30 border border-amber-500/50 border-t-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setGameTimerMinutes((m) => Math.max(10, m - 10))}
                  disabled={gameTimerMinutes <= 10}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-amber-400 active:bg-white/20 disabled:opacity-30 text-lg font-bold cursor-pointer"
                >
                  −
                </button>
                <div className="text-center">
                  <span className="text-lg font-bold text-amber-400 tabular-nums">
                    {Math.floor(gameTimerMinutes / 60)}h {String(gameTimerMinutes % 60).padStart(2, "0")}m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGameTimerMinutes((m) => Math.min(300, m + 10))}
                  disabled={gameTimerMinutes >= 300}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-amber-400 active:bg-white/20 disabled:opacity-30 text-lg font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Turn Timer (requires Game Timer) */}
          <button
            type="button"
            onClick={() => gameTimer && setTurnTimer(!turnTimer)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
              !gameTimer && "opacity-40 cursor-not-allowed",
              gameTimer && "cursor-pointer",
              turnTimer
                ? "bg-blue-900/30 border-blue-500/50"
                : "bg-bg-card border-border"
            )}
          >
            <svg className={cn("w-5 h-5 flex-shrink-0", turnTimer ? "text-blue-400" : "text-text-muted")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-left">
              <span className={cn("text-sm font-semibold block", turnTimer ? "text-blue-400" : "text-text-secondary")}>
                Turn Timer
              </span>
              {!gameTimer && (
                <span className="text-[10px] text-text-muted">Requires Game Timer</span>
              )}
            </div>
            <div className={cn(
              "w-10 h-6 rounded-full transition-colors relative",
              turnTimer ? "bg-blue-500" : "bg-white/10"
            )}>
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                turnTimer ? "translate-x-5" : "translate-x-1"
              )} />
            </div>
          </button>
        </div>

        {/* ── Customize Players ── */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Customize Players
          </label>
          <div className="space-y-2">
            {Array.from({ length: playerCount }, (_, i) => {
              const selectedKey = selectedColorKeys[i] ?? "R";
              const selectedMtgColor = MTG_PLAYER_COLORS.find((c) => c.key === selectedKey)!;
              const usedNames = playerNames.slice(0, playerCount);
              const availableMembers = playgroupMembers.filter(
                (m) => m.name === playerNames[i] || !usedNames.includes(m.name)
              );
              return (
                <div
                  key={i}
                  className="glass-card rounded-xl overflow-hidden border-2 transition-colors duration-200"
                  style={{ borderColor: selectedMtgColor.color }}
                >
                  {/* Colored header bar */}
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ backgroundColor: `${selectedMtgColor.color}30` }}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedMtgColor.color }} />
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: selectedMtgColor.color }}>
                      Player {i + 1}
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={playerNames[i]}
                      onChange={(e) => handleNameChange(i, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      className="flex-1"
                    />
                  </div>
                  {/* Playgroup dropdown */}
                  {availableMembers.length > 0 && (
                    <select
                      value={availableMembers.some((m) => m.name === playerNames[i]) ? playerNames[i] : ""}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          handleNameChange(i, `Player ${i + 1}`);
                        } else {
                          handleNameChange(i, e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-bg-hover/50 border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.5rem center", backgroundSize: "1.25rem" }}
                    >
                      <option value="">Select from playgroup...</option>
                      {availableMembers.map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-muted uppercase tracking-wide mr-1">Color</span>
                    {MTG_PLAYER_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => handleColorChange(i, c.key as MtgPlayerColorKey)}
                        title={c.label}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150",
                          selectedKey === c.key
                            ? "ring-2 ring-white ring-offset-1 ring-offset-bg-card scale-110"
                            : "opacity-60 hover:opacity-90"
                        )}
                      >
                        <ManaSymbol symbol={c.key} size={18} />
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Multiplayer ── */}
        {multiplayerRoom && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Multiplayer</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <MultiplayerLobby
              roomCode={multiplayerRoom.roomCode}
              isHost={multiplayerRoom.isHost}
              isConnected={multiplayerRoom.isConnected}
              remotePlayers={multiplayerRoom.remotePlayers}
              localPlayer={{ name: playerNames[0], color: MTG_PLAYER_COLORS.find(c => c.key === selectedColorKeys[0])?.color ?? "#607D8B" }}
              onCreateRoom={multiplayerRoom.onCreateRoom}
              onJoinRoom={multiplayerRoom.onJoinRoom}
              onLeaveRoom={multiplayerRoom.onLeaveRoom}
              onStartGame={multiplayerRoom.onStartGame}
            />
          </div>
        )}

        {/* ── Start Button ── */}
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-4 rounded-2xl btn-gradient text-lg font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
        >
          START GAME
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
