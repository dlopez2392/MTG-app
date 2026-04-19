"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS } from "@/lib/constants";
import type { Player } from "@/types/life";

function hexToMtgQuery(hex: string): string {
  return MTG_PLAYER_COLORS.find((c) => c.color === hex)?.mtgQuery ?? "r";
}

const CMDR_KEY = "__cmdr__";

interface SlashParticle { id: number; kind: "slash"; offsetY: number; angle: number; delay: number; }
interface HealParticle { id: number; kind: "heal"; offsetX: number; offsetY: number; delay: number; }
type Particle = SlashParticle | HealParticle;

let nextId = 0;

function spawnParticles(delta: number): Particle[] {
  if (delta < 0) {
    return [-16, 0, 16].map((offsetY, i): SlashParticle => ({
      id: nextId++, kind: "slash", offsetY, angle: -48 + Math.random() * 16, delay: i * 60,
    }));
  }
  return Array.from({ length: 7 }, (_, i): HealParticle => ({
    id: nextId++, kind: "heal",
    offsetX: (Math.random() - 0.5) * 90,
    offsetY: (Math.random() - 0.5) * 50,
    delay: i * 70,
  }));
}

interface PlayerPanelProps {
  player: Player;
  onLifeChange: (delta: number) => void;
  onCommanderDamage: (delta: number, sourcePlayerId?: string) => void;
  onPoisonChange?: (delta: number) => void;
  className?: string;
  showPoisonCounters?: boolean;
  perCommanderTracking?: boolean;
  opponents?: Player[];
  onTapPanel?: () => void;
  disabled?: boolean;
  /** Turn timer state — only passed to the active player's panel */
  turnTimer?: {
    turnNumber: number;
    turnSeconds: number;
    running: boolean;
    onToggle: () => void;
    onNext: () => void;
  };
  /** Rotation in degrees so content faces outward toward nearest screen edge */
  rotation?: number;
}

export default function PlayerPanel({
  player,
  onLifeChange,
  onCommanderDamage,
  onPoisonChange,
  className,
  showPoisonCounters = false,
  perCommanderTracking = false,
  opponents = [],
  onTapPanel,
  disabled = false,
  turnTimer,
  rotation = 0,
}: PlayerPanelProps) {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showCmdr, setShowCmdr] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLifeRef = useRef(player.life);
  const [lifeHistory, setLifeHistory] = useState<{ id: number; delta: number; total: number }[]>([]);

  useEffect(() => {
    const mtgColor = hexToMtgQuery(player.color);
    fetch(`https://api.scryfall.com/cards/random?q=type%3Alegendary+color%3A${mtgColor}`)
      .then((r) => r.json())
      .then((card) => {
        setArtUrl(card?.image_uris?.art_crop ?? card?.card_faces?.[0]?.image_uris?.art_crop ?? null);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  useEffect(() => {
    const prev = prevLifeRef.current;
    const curr = player.life;
    if (prev === curr) { prevLifeRef.current = curr; return; }
    prevLifeRef.current = curr;
    const d = curr - prev;
    const spawned = spawnParticles(d);
    setParticles((p) => [...p, ...spawned]);
    const ids = new Set(spawned.map((s) => s.id));
    const timer = setTimeout(() => setParticles((p) => p.filter((x) => !ids.has(x.id))), 1000);

    setDelta((prev) => (prev ?? 0) + d);
    if (deltaTimer.current) clearTimeout(deltaTimer.current);
    deltaTimer.current = setTimeout(() => setDelta(null), 1200);

    setLifeHistory((h) => [{ id: nextId++, delta: d, total: curr }, ...h].slice(0, 20));

    return () => clearTimeout(timer);
  }, [player.life]);

  const handleTapZone = useCallback((isTop: boolean) => {
    if (disabled) { onTapPanel?.(); return; }
    onLifeChange(isTop ? 1 : -1);
  }, [disabled, onTapPanel, onLifeChange]);

  const cmdrTotal = Object.entries(player.commanderDamage)
    .reduce((sum, [, v]) => sum + v, 0);

  // For 90/-90 rotation, the inner content needs to be sized to fill the
  // rotated viewport (swap width/height dimensions).
  const isSideways = rotation === 90 || rotation === -90;

  return (
    <div
      className={cn(
        "relative select-none overflow-hidden rounded-2xl transition-transform duration-300",
        className
      )}
      style={{
        backgroundColor: `${player.color}B3`,
      }}
    >
      {/* Rotated content wrapper — rotates everything so content faces outward */}
      <div
        className="absolute inset-0"
        style={
          isSideways
            ? {
                width: "100%",
                height: "100%",
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }
            : rotation === 180
              ? { transform: "rotate(180deg)", transformOrigin: "center center" }
              : undefined
        }
      >
      {/* Art background */}
      {artUrl && (
        <img
          src={artUrl} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: 0.55, filter: "saturate(1.3) brightness(0.7)" }}
        />
      )}

      {/* Edge vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%),
                     linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.25) 100%)`,
      }} />

      {/* ── Tap zones (no visible buttons) ── */}
      <button
        type="button"
        onClick={() => handleTapZone(true)}
        className="absolute top-0 left-0 right-0 h-1/2 z-10 cursor-pointer active:bg-white/5 transition-colors"
        aria-label="Increase life"
      />
      <button
        type="button"
        onClick={() => handleTapZone(false)}
        className="absolute bottom-0 left-0 right-0 h-1/2 z-10 cursor-pointer active:bg-white/5 transition-colors"
        aria-label="Decrease life"
      />

      {/* ── Life total + player name — centered ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
        <div className="relative flex flex-col items-center" style={{ overflow: "visible" }}>
          <span
            className="text-[5rem] tabular-nums leading-none"
            style={{
              fontFamily: "'Arial', 'Helvetica', sans-serif",
              fontWeight: 400,
              letterSpacing: "0.02em",
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.1)",
              position: "relative",
              zIndex: 2,
            }}
          >
            {player.life}
          </span>

          {/* Delta indicator */}
          {delta !== null && (
            <span
              className={cn(
                "absolute -top-5 left-1/2 -translate-x-1/2 text-lg font-black tabular-nums",
                delta > 0 ? "text-green-400" : "text-red-400"
              )}
              style={{ zIndex: 3, textShadow: "0 0 8px currentColor" }}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}

          {/* Particles */}
          {particles.map((p) => {
            if (p.kind === "slash") {
              return (
                <div key={p.id} aria-hidden className="pointer-events-none absolute" style={{
                  zIndex: 1, top: `calc(50% + ${p.offsetY}px)`, left: "-30px", right: "-30px",
                  height: "10px", marginTop: "-5px", transformOrigin: "center center",
                  transform: `rotate(${p.angle}deg)`,
                  background: "linear-gradient(90deg, transparent 0%, #ff1111 15%, #ff5555 40%, #ffffff88 50%, #ff5555 60%, #ff1111 85%, transparent 100%)",
                  borderRadius: "5px",
                  boxShadow: "0 0 10px 3px rgba(255,20,20,0.8), 0 0 20px 4px rgba(255,20,20,0.4)",
                  animation: `life-slash 0.7s ease-out ${p.delay}ms both`,
                }} />
              );
            }
            return (
              <div key={p.id} aria-hidden className="pointer-events-none absolute font-black leading-none select-none" style={{
                zIndex: 1, top: `calc(50% + ${p.offsetY}px)`, left: `calc(50% + ${p.offsetX}px)`,
                transform: "translate(-50%, -50%)", fontSize: "28px", color: "#00ff55",
                textShadow: "0 0 10px rgba(0,255,85,1), 0 0 22px rgba(0,255,85,0.7), 0 0 40px rgba(0,255,85,0.4)",
                animation: `life-heal 0.95s ease-out ${p.delay}ms both`,
              }}>+</div>
            );
          })}

          {/* Player name */}
          <span
            className="text-sm tracking-wide uppercase mt-1"
            style={{
              fontFamily: "'Arial', 'Helvetica', sans-serif",
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.5), 0 0 12px rgba(255,255,255,0.2)",
              zIndex: 2,
            }}
          >
            {player.name}
          </span>

        </div>
      </div>

      {/* ── Life history — right edge ── */}
      {lifeHistory.length > 0 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-[4] pointer-events-none flex flex-col items-end gap-0.5 max-h-[60%] overflow-hidden">
          {lifeHistory.slice(0, 8).map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/40"
              style={{ opacity: 1 - i * 0.1 }}
            >
              <span className={cn(
                "text-[10px] font-bold tabular-nums",
                entry.delta > 0 ? "text-green-400" : "text-red-400"
              )}>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </span>
              <span className="text-[10px] text-white/40 tabular-nums">
                {entry.total}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Turn timer bar — only on active player, bottom center ── */}
      {turnTimer && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 px-1.5 py-1 shadow-lg">
          <span className="text-[11px] font-black uppercase tracking-wider text-accent/90 pl-2">
            T{turnTimer.turnNumber}
          </span>
          <span className="text-base font-bold tabular-nums text-white" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
            {Math.floor(turnTimer.turnSeconds / 60)}:{String(turnTimer.turnSeconds % 60).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); turnTimer.onToggle(); }}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all z-30"
          >
            {turnTimer.running ? (
              <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); turnTimer.onNext(); }}
            className="px-3 py-1 rounded-full btn-gradient text-[10px] font-black uppercase tracking-wide active:scale-95 transition-transform z-30"
          >
            Next
          </button>
          {!turnTimer.running && (
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400/80 pr-1">Paused</span>
          )}
        </div>
      )}

      {/* ── Bottom corners: poison (left) + commander damage (right) ── */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1">
        {showPoisonCounters && onPoisonChange && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPoisonChange(1); }}
            className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-black/50 backdrop-blur-sm active:scale-90 transition-transform"
          >
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C9.5 2 7 4 7 7c0 2 1 3.5 2 4.5V15h6v-3.5c1-1 2-2.5 2-4.5 0-3-2.5-5-5-5zm-1 13v4h2v-4h-2z"/>
            </svg>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              player.poisonCounters >= 10 ? "text-red-400" : "text-white/80"
            )}>
              {player.poisonCounters}
            </span>
          </button>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowCmdr(!showCmdr); }}
          className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-black/50 backdrop-blur-sm active:scale-90 transition-transform"
        >
          <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 17h18v2H3v-2zM4 7l3.5 7 4.5-5 4.5 5L20 7v8H4V7z" />
          </svg>
          {cmdrTotal > 0 && (
            <span className={cn("text-xs font-bold tabular-nums", cmdrTotal >= 21 ? "text-red-400" : "text-white/80")}>
              {cmdrTotal}
            </span>
          )}
        </button>
      </div>

      {/* Commander damage count badge — top-left corner */}
      {cmdrTotal > 0 && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm pointer-events-none">
          <svg className="w-3.5 h-3.5 text-white/60" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 17h18v2H3v-2zM4 7l3.5 7 4.5-5 4.5 5L20 7v8H4V7z" />
          </svg>
          <span className={cn("text-[10px] font-bold tabular-nums", cmdrTotal >= 21 ? "text-red-400" : "text-white/70")}>
            {cmdrTotal}
          </span>
        </div>
      )}



      {/* ── Commander damage overlay ── */}
      {showCmdr && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3">
          <p className="text-[10px] text-white/60 uppercase tracking-widest font-semibold mb-1">Commander Damage</p>

          {perCommanderTracking && opponents.length > 0 ? (
            opponents.map((opp) => {
              const oppDmg = player.commanderDamage[opp.id] ?? 0;
              return (
                <div key={opp.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => onCommanderDamage(-1, opp.id)} disabled={oppDmg <= 0}
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 disabled:opacity-30 text-sm">−</button>
                  <div className="flex items-center gap-1.5 min-w-[60px] justify-center">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opp.color }} />
                    <span className={cn("text-sm font-bold tabular-nums", oppDmg >= 21 ? "text-red-400" : "text-white")}>
                      {oppDmg}
                    </span>
                  </div>
                  <button type="button" onClick={() => onCommanderDamage(1, opp.id)}
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 text-sm">+</button>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => onCommanderDamage(-1)} disabled={(player.commanderDamage[CMDR_KEY] ?? 0) <= 0}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 disabled:opacity-30 text-lg">−</button>
              <span className={cn("text-2xl font-bold tabular-nums", (player.commanderDamage[CMDR_KEY] ?? 0) >= 21 ? "text-red-400" : "text-white")}>
                {player.commanderDamage[CMDR_KEY] ?? 0}
              </span>
              <button type="button" onClick={() => onCommanderDamage(1)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 text-lg">+</button>
            </div>
          )}

          <button type="button" onClick={() => setShowCmdr(false)}
            className="mt-1 px-4 py-1.5 rounded-full bg-white/10 text-xs font-semibold text-white/70 active:bg-white/20">
            Done
          </button>
        </div>
      )}
      </div>{/* end rotation wrapper */}
    </div>
  );
}
