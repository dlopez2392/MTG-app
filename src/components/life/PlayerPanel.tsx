"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS } from "@/lib/constants";
import type { Player } from "@/types/life";

function hexToMtgQuery(hex: string): string {
  return MTG_PLAYER_COLORS.find((c) => c.color === hex)?.mtgQuery ?? "r";
}

const CMDR_KEY = "__cmdr__";

// ── Particle types ──────────────────────────────────────────────────────────

interface SlashParticle {
  id: number;
  kind: "slash";
  /** px offset from center of the life number, vertically */
  offsetY: number;
  /** rotation angle in degrees */
  angle: number;
  delay: number;
}

interface HealParticle {
  id: number;
  kind: "heal";
  /** px offset from center of the life number, horizontally */
  offsetX: number;
  /** px offset from center of the life number, vertically (start position) */
  offsetY: number;
  delay: number;
}

type Particle = SlashParticle | HealParticle;

let nextId = 0;

function spawnParticles(delta: number): Particle[] {
  if (delta < 0) {
    // 3 thick red slash lines layered over the number
    const offsets = [-16, 0, 16];
    return offsets.map((offsetY, i): SlashParticle => ({
      id: nextId++,
      kind: "slash",
      offsetY,
      angle: -48 + Math.random() * 16,
      delay: i * 60,
    }));
  } else {
    // 7 large green pluses orbiting/floating around the number
    return Array.from({ length: 7 }, (_, i): HealParticle => ({
      id: nextId++,
      kind: "heal",
      offsetX: (Math.random() - 0.5) * 90, // ±45 px from center
      offsetY: (Math.random() - 0.5) * 50, // ±25 px from center
      delay: i * 70,
    }));
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface PlayerPanelProps {
  player: Player;
  onLifeChange: (delta: number) => void;
  onCommanderDamage: (delta: number, sourcePlayerId?: string) => void;
  onPoisonChange?: (delta: number) => void;
  isRotated?: boolean;
  className?: string;
  showPoisonCounters?: boolean;
  perCommanderTracking?: boolean;
  opponents?: Player[];
}

export default function PlayerPanel({
  player,
  onLifeChange,
  onCommanderDamage,
  onPoisonChange,
  isRotated = false,
  className,
  showPoisonCounters = false,
  perCommanderTracking = false,
  opponents = [],
}: PlayerPanelProps) {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const prevLifeRef = useRef(player.life);

  useEffect(() => {
    const mtgColor = hexToMtgQuery(player.color);
    fetch(
      `https://api.scryfall.com/cards/random?q=type%3Alegendary+color%3A${mtgColor}`
    )
      .then((r) => r.json())
      .then((card) => {
        const url =
          card?.image_uris?.art_crop ??
          card?.card_faces?.[0]?.image_uris?.art_crop ??
          null;
        setArtUrl(url);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  // Spawn particles whenever life changes
  useEffect(() => {
    const prev = prevLifeRef.current;
    const curr = player.life;
    if (prev === curr) { prevLifeRef.current = curr; return; }

    prevLifeRef.current = curr;
    const delta = curr - prev;
    const spawned = spawnParticles(delta);
    setParticles((p) => [...p, ...spawned]);

    const ids = new Set(spawned.map((s) => s.id));
    const timer = setTimeout(
      () => setParticles((p) => p.filter((x) => !ids.has(x.id))),
      1000
    );
    return () => clearTimeout(timer);
  }, [player.life]);

  const cmdrDmg = player.commanderDamage[CMDR_KEY] ?? 0;
  const cmdrDangerous = cmdrDmg >= 21;

  return (
    <div
      className={cn(
        "relative flex flex-col select-none overflow-hidden rounded-xl",
        isRotated && "rotate-180",
        className
      )}
      style={{ backgroundColor: `${player.color}18` }}
    >
      {/* Card art background */}
      {artUrl && (
        <img
          src={artUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: 0.50, filter: "saturate(1.4) brightness(0.75)" }}
        />
      )}

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 20%, ${player.color}28 100%)`,
        }}
      />

      {/* ── Top: player name ── */}
      <div className="relative z-10 flex items-center justify-center gap-2 pt-2 pb-0.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
        <span className="text-xs font-medium text-text-secondary">{player.name}</span>
      </div>

      {/* ── Middle: life total ── */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 min-h-0">
        <button
          onClick={() => onLifeChange(1)}
          className="flex items-center justify-center w-full py-1 text-3xl font-bold text-white/60 hover:text-white active:text-legal transition-colors"
          aria-label="Increase life"
        >
          +
        </button>

        {/* Life number + particle origin — overflow visible so particles escape */}
        <div className="relative" style={{ overflow: "visible" }}>
          <span
            className="relative text-6xl font-black tabular-nums drop-shadow-lg leading-none"
            style={{ color: player.color, zIndex: 2 }}
          >
            {player.life}
          </span>

          {/* Particles anchored to this div's center — z-index 1 so they sit behind the number */}
          {particles.map((p) => {
            if (p.kind === "slash") {
              return (
                <div
                  key={p.id}
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    zIndex: 1,
                    top: `calc(50% + ${p.offsetY}px)`,
                    left: "-30px",
                    right: "-30px",
                    height: "10px",
                    marginTop: "-5px",
                    transformOrigin: "center center",
                    transform: `rotate(${p.angle}deg)`,
                    background:
                      "linear-gradient(90deg, transparent 0%, #ff1111 15%, #ff5555 40%, #ffffff88 50%, #ff5555 60%, #ff1111 85%, transparent 100%)",
                    borderRadius: "5px",
                    boxShadow: "0 0 10px 3px rgba(255,20,20,0.8), 0 0 20px 4px rgba(255,20,20,0.4)",
                    animation: `life-slash 0.7s ease-out ${p.delay}ms both`,
                  }}
                />
              );
            }

            // heal plus
            return (
              <div
                key={p.id}
                aria-hidden
                className="pointer-events-none absolute font-black leading-none select-none"
                style={{
                  zIndex: 1,
                  top: `calc(50% + ${p.offsetY}px)`,
                  left: `calc(50% + ${p.offsetX}px)`,
                  transform: "translate(-50%, -50%)",
                  fontSize: "28px",
                  color: "#00ff55",
                  textShadow:
                    "0 0 10px rgba(0,255,85,1), 0 0 22px rgba(0,255,85,0.7), 0 0 40px rgba(0,255,85,0.4)",
                  animation: `life-heal 0.95s ease-out ${p.delay}ms both`,
                }}
              >
                +
              </div>
            );
          })}
        </div>

        <button
          onClick={() => onLifeChange(-1)}
          className="flex items-center justify-center w-full py-1 text-3xl font-bold text-white/60 hover:text-white active:text-banned transition-colors"
          aria-label="Decrease life"
        >
          −
        </button>
      </div>

      {/* ── Bottom: poison + commander damage ── */}
      <div className="relative z-10 flex flex-col items-center gap-1 pb-2">
        {/* Poison counters */}
        {showPoisonCounters && onPoisonChange && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPoisonChange(-1)}
              disabled={player.poisonCounters <= 0}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/40 text-sm text-white/60 hover:text-white disabled:opacity-30 leading-none"
            >−</button>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C9.5 2 7 4 7 7c0 2 1 3.5 2 4.5V15h6v-3.5c1-1 2-2.5 2-4.5 0-3-2.5-5-5-5zm-1 13v4h2v-4h-2z"/>
              </svg>
              <span className={cn(
                "text-sm font-bold tabular-nums leading-none",
                player.poisonCounters >= 10 ? "text-banned" : player.poisonCounters >= 5 ? "text-restricted" : "text-white/90"
              )}>
                {player.poisonCounters}
              </span>
            </div>
            <button
              onClick={() => onPoisonChange(1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/40 text-sm text-white/60 hover:text-white leading-none"
            >+</button>
          </div>
        )}

        {/* Commander damage — per-opponent when tracking enabled, single total otherwise */}
        {perCommanderTracking && opponents.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {opponents.map((opp) => {
              const oppDmg = player.commanderDamage[opp.id] ?? 0;
              const oppDangerous = oppDmg >= 21;
              return (
                <div key={opp.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => onCommanderDamage(-1, opp.id)}
                    disabled={oppDmg <= 0}
                    className="w-5 h-5 flex items-center justify-center rounded bg-black/40 text-xs text-white/60 hover:text-white disabled:opacity-30 leading-none"
                  >−</button>
                  <div className="flex items-center gap-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opp.color }} />
                    <span className={cn("text-xs font-bold tabular-nums leading-none", oppDangerous ? "text-banned" : "text-white/90")}>
                      {oppDmg}
                    </span>
                  </div>
                  <button
                    onClick={() => onCommanderDamage(1, opp.id)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-black/40 text-xs text-white/60 hover:text-white leading-none"
                  >+</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onCommanderDamage(-1)}
              disabled={cmdrDmg <= 0}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/40 text-sm text-white/60 hover:text-white disabled:opacity-30 leading-none"
            >−</button>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 17h18v2H3v-2zM4 7l3.5 7 4.5-5 4.5 5L20 7v8H4V7z" />
              </svg>
              <span className={cn("text-base font-bold tabular-nums leading-none", cmdrDangerous ? "text-banned" : "text-white/90")}>
                {cmdrDmg}
              </span>
            </div>
            <button
              onClick={() => onCommanderDamage(1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/40 text-sm text-white/60 hover:text-white leading-none"
            >+</button>
          </div>
        )}
      </div>
    </div>
  );
}
