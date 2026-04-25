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
  onEnergyChange?: (delta: number) => void;
  onExperienceChange?: (delta: number) => void;
  onMonarchToggle?: () => void;
  onInitiativeToggle?: () => void;
  onDungeonChange?: (delta: number) => void;
  showEnergyCounters?: boolean;
  showExperienceCounters?: boolean;
  showMonarch?: boolean;
  showInitiative?: boolean;
  showDungeon?: boolean;
  onTapPanel?: () => void;
  disabled?: boolean;
  turnTimer?: {
    turnNumber: number;
    turnSeconds: number;
    running: boolean;
    onToggle: () => void;
    onNext: () => void;
  };
  rotation?: number;
  compact?: boolean;
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
  onEnergyChange,
  onExperienceChange,
  onMonarchToggle,
  onInitiativeToggle,
  onDungeonChange,
  showEnergyCounters = false,
  showExperienceCounters = false,
  showMonarch = false,
  showInitiative = false,
  showDungeon = false,
  onTapPanel,
  disabled = false,
  turnTimer,
  rotation = 0,
  compact = false,
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
    let cancelled = false;
    const fetchArt = (attempt: number) => {
      fetch(`https://api.scryfall.com/cards/random?q=type%3Alegendary+color%3A${mtgColor}`)
        .then((r) => r.json())
        .then((card) => {
          if (cancelled) return;
          const url =
            card?.image_uris?.art_crop ??
            card?.card_faces?.[0]?.image_uris?.art_crop ??
            card?.image_uris?.large ??
            card?.card_faces?.[0]?.image_uris?.large ??
            null;
          if (url) {
            setArtUrl(url);
          } else if (attempt < 3) {
            setTimeout(() => fetchArt(attempt + 1), 500);
          }
        })
        .catch(() => {
          if (!cancelled && attempt < 3) {
            setTimeout(() => fetchArt(attempt + 1), 1000 * attempt);
          }
        });
    };
    fetchArt(1);
    return () => { cancelled = true; };
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

  // Position buttons on the panel's outward edge (away from screen center / menu button)
  return (
    <div
      className={cn(
        "relative select-none overflow-hidden rounded-lg transition-transform duration-300",
        className
      )}
      style={{
        backgroundColor: `${player.color}B3`,
      }}
    >
      {/* Rotated content wrapper — rotates everything so content faces outward */}
      <div
        className="absolute overflow-hidden"
        style={{
          ...(isSideways ? {
            width: "200%",
            height: "200%",
            top: "-50%",
            left: "-50%",
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center center",
          } : rotation === 180 ? {
            inset: 0,
            transform: "rotate(180deg)",
            transformOrigin: "center center",
          } : {
            inset: 0,
          }),
        }}
      >
      {/* Art background — oversized to guarantee full coverage on all panel shapes */}
      {artUrl && (
        <div className="absolute pointer-events-none" style={{ inset: "-40%", opacity: 0.55 }}>
          <img
            src={artUrl} alt="" aria-hidden
            className="w-full h-full object-cover"
            style={{ filter: "saturate(1.3) brightness(0.7)" }}
          />
        </div>
      )}

      {/* Edge vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)`,
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
      <div className={cn("absolute inset-0 flex items-center justify-center pointer-events-none", turnTimer ? "z-[15]" : "z-[5]")}>
        <div className="relative flex flex-col items-center" style={{ overflow: "visible" }}>
          <div className="flex items-center gap-8" style={{ position: "relative", zIndex: 2 }}>
            {/* Commander icon — left of life total */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowCmdr(!showCmdr); }}
              className="pointer-events-auto flex items-center gap-1 active:scale-90 transition-transform"
              style={{ opacity: cmdrTotal > 0 ? 1 : 0.6 }}
            >
              <svg className={cn(compact ? "w-6 h-6" : "w-7 h-7")} viewBox="0 0 120 110">
                <defs>
                  <linearGradient id={`cg-${player.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8D078"/>
                    <stop offset="40%" stopColor="#C8A040"/>
                    <stop offset="100%" stopColor="#987020"/>
                  </linearGradient>
                </defs>
                <path d="M60 4 L82 28 L82 62 L60 78 L38 62 L38 28 Z" fill={`url(#cg-${player.id})`} stroke="#2A2218" strokeWidth="6" strokeLinejoin="round"/>
                <path d="M36 32 L14 44 L6 72 L34 96 L46 84 L44 58 Z" fill={`url(#cg-${player.id})`} stroke="#2A2218" strokeWidth="6" strokeLinejoin="round"/>
                <path d="M84 32 L106 44 L114 72 L86 96 L74 84 L76 58 Z" fill={`url(#cg-${player.id})`} stroke="#2A2218" strokeWidth="6" strokeLinejoin="round"/>
              </svg>
              {cmdrTotal > 0 && (
                <span className={cn("text-xs font-bold tabular-nums", cmdrTotal >= 21 ? "text-red-400" : "text-white/70")}>
                  {cmdrTotal}
                </span>
              )}
            </button>

            <span
              className={cn("tabular-nums leading-none", compact ? "text-[3rem]" : "text-[5rem]")}
              style={{
                fontFamily: "'Arial', 'Helvetica', sans-serif",
                fontWeight: 400,
                letterSpacing: "0.02em",
                color: "#fff",
                textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.1)",
              }}
            >
              {player.life}
            </span>
          </div>

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
                  zIndex: 6, top: `calc(50% + ${p.offsetY}px)`, left: "-30px", right: "-30px",
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
                zIndex: 6, top: `calc(50% + ${p.offsetY}px)`, left: `calc(50% + ${p.offsetX}px)`,
                transform: "translate(-50%, -50%)", fontSize: "28px", color: "#00ff55",
                textShadow: "0 0 10px rgba(0,255,85,1), 0 0 22px rgba(0,255,85,0.7), 0 0 40px rgba(0,255,85,0.4)",
                animation: `life-heal 0.95s ease-out ${p.delay}ms both`,
              }}>+</div>
            );
          })}

          {/* Player name */}
          <span
            className={cn("tracking-wide uppercase mt-1", compact ? "text-[10px]" : "text-sm")}
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

          {/* Turn timer — inline below name, rotates with panel */}
          {turnTimer && (
            <div
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg mt-2 px-2.5 py-1.5"
              style={{ zIndex: 10, minHeight: "44px" }}
            >
              <span className="font-black uppercase tracking-wider text-accent/90 pl-1 text-[11px]">
                T{turnTimer.turnNumber}
              </span>
              <span className="font-bold tabular-nums text-white text-base" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
                {Math.floor(turnTimer.turnSeconds / 60)}:{String(turnTimer.turnSeconds % 60).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); turnTimer.onToggle(); }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all"
              >
                {turnTimer.running ? (
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); turnTimer.onNext(); }}
                className="rounded-full btn-gradient font-black uppercase tracking-wide active:scale-95 transition-transform px-4 text-[10px] h-10"
              >
                Next
              </button>
              {!turnTimer.running && (
                <span className="font-bold uppercase tracking-widest text-amber-400/80 pr-1 text-[9px]">Paused</span>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Life history — right edge ── */}
      {lifeHistory.length > 0 && (
        <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 z-[4] pointer-events-none flex flex-col items-end gap-0.5 overflow-hidden", compact ? "max-h-[50%]" : "max-h-[60%]")}>
          {lifeHistory.slice(0, compact ? 5 : 8).map((entry, i) => (
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

      </div>{/* end rotation wrapper */}

      {/* ── Counter badges — positioned on panel, rotated to face player ── */}
      <div className="absolute z-20 flex flex-col gap-2" style={{
        transform: `rotate(${rotation}deg)`,
        ...(isSideways
          ? { bottom: "50%", left: "8px", transformOrigin: "left center", marginBottom: "-20px" }
          : { bottom: "12px", left: "12px" }),
      }}>
        {showPoisonCounters && onPoisonChange && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPoisonChange(1); }}
            className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm active:scale-90 transition-transform px-2.5 py-2 min-h-[44px]"
          >
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C9.5 2 7 4 7 7c0 2 1 3.5 2 4.5V15h6v-3.5c1-1 2-2.5 2-4.5 0-3-2.5-5-5-5zm-1 13v4h2v-4h-2z"/>
            </svg>
            <span className={cn("text-sm font-bold tabular-nums", player.poisonCounters >= 10 ? "text-red-400" : "text-white/80")}>
              {player.poisonCounters}
            </span>
          </button>
        )}
        {showEnergyCounters && onEnergyChange && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEnergyChange(1); }}
            className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm active:scale-90 transition-transform px-2.5 py-2 min-h-[44px]"
          >
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span className="text-sm font-bold tabular-nums text-white/80">{player.energyCounters}</span>
          </button>
        )}
        {showExperienceCounters && onExperienceChange && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExperienceChange(1); }}
            className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm active:scale-90 transition-transform px-2.5 py-2 min-h-[44px]"
          >
            <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.77 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z"/>
            </svg>
            <span className="text-sm font-bold tabular-nums text-white/80">{player.experienceCounters}</span>
          </button>
        )}
        {showMonarch && onMonarchToggle && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMonarchToggle(); }}
            className={cn("flex items-center gap-1.5 rounded-full backdrop-blur-sm active:scale-90 transition-transform px-2.5 py-2 min-h-[44px]", player.isMonarch ? "bg-yellow-600/70" : "bg-black/60")}
          >
            <svg className={cn("w-5 h-5 flex-shrink-0", player.isMonarch ? "text-yellow-300" : "text-white/70")} fill="currentColor" viewBox="0 0 24 24">
              <path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4-2 8zm2-12l2 2 4-8 4 8 4-8 2 2"/>
            </svg>
            <span className={cn("text-sm font-bold", player.isMonarch ? "text-yellow-300" : "text-white/70")}>
              Monarch
            </span>
          </button>
        )}
        {showInitiative && onInitiativeToggle && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInitiativeToggle(); }}
            className={cn("flex items-center gap-1.5 rounded-full backdrop-blur-sm active:scale-90 transition-transform px-2.5 py-2 min-h-[44px]", player.hasInitiative ? "bg-blue-600/70" : "bg-black/60")}
          >
            <svg className={cn("w-5 h-5 flex-shrink-0", player.hasInitiative ? "text-blue-300" : "text-white/70")} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/>
            </svg>
            <span className={cn("text-sm font-bold", player.hasInitiative ? "text-blue-300" : "text-white/70")}>
              Initiative
            </span>
          </button>
        )}
        {showDungeon && onDungeonChange && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDungeonChange(1); }}
            className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm active:scale-90 transition-transform px-2.5 py-2 min-h-[44px]"
          >
            <svg className="w-5 h-5 text-stone-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm4 2h6v2h-2v2h2v2h-2v2h2v2H9v-2h2v-2H9v-2h2V9H9V7z"/>
            </svg>
            <span className="text-sm font-bold tabular-nums text-white/80">{player.dungeonLevel}</span>
          </button>
        )}
      </div>

      {/* ── Commander damage overlay ── */}
      {showCmdr && (
        <div
          className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <p className="text-[10px] text-white/60 uppercase tracking-widest font-semibold mb-1">Commander Damage</p>

          {perCommanderTracking && opponents.length > 0 ? (
            opponents.map((opp) => {
              const oppDmg = player.commanderDamage[opp.id] ?? 0;
              return (
                <div key={opp.id} className="flex items-center gap-3">
                  <button type="button" onClick={() => onCommanderDamage(-1, opp.id)} disabled={oppDmg <= 0}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 disabled:opacity-30 text-lg font-bold">−</button>
                  <div className="flex items-center gap-1.5 min-w-[60px] justify-center">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: opp.color }} />
                    <span className={cn("text-base font-bold tabular-nums", oppDmg >= 21 ? "text-red-400" : "text-white")}>
                      {oppDmg}
                    </span>
                  </div>
                  <button type="button" onClick={() => onCommanderDamage(1, opp.id)}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 text-lg font-bold">+</button>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => onCommanderDamage(-1)} disabled={(player.commanderDamage[CMDR_KEY] ?? 0) <= 0}
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 disabled:opacity-30 text-xl font-bold">−</button>
              <span className={cn("text-3xl font-bold tabular-nums", (player.commanderDamage[CMDR_KEY] ?? 0) >= 21 ? "text-red-400" : "text-white")}>
                {player.commanderDamage[CMDR_KEY] ?? 0}
              </span>
              <button type="button" onClick={() => onCommanderDamage(1)}
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20 text-xl font-bold">+</button>
            </div>
          )}

          <button type="button" onClick={() => setShowCmdr(false)}
            className="mt-2 px-6 py-2.5 rounded-full bg-white/10 text-sm font-bold text-white/70 active:bg-white/20 min-h-[44px]">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
