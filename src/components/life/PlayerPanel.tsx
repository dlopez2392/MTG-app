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
  /** top offset 20–65% so slashes spread across the panel */
  top: number;
  /** rotation between -55 and -35 deg so they look like claw marks */
  angle: number;
  /** stagger delay in ms */
  delay: number;
}

interface HealParticle {
  id: number;
  kind: "heal";
  /** left offset 15–80% */
  left: number;
  /** starting bottom offset 25–55% */
  bottom: number;
  /** stagger delay in ms */
  delay: number;
}

type Particle = SlashParticle | HealParticle;

let nextId = 0;

function spawnParticles(delta: number): Particle[] {
  const count = Math.min(Math.abs(delta), 4); // at most 4 per hit
  const n = Math.max(count, 3);

  if (delta < 0) {
    // Damage — 3 slash marks spread vertically
    return Array.from({ length: n }, (_, i): SlashParticle => ({
      id: nextId++,
      kind: "slash",
      top: 18 + i * 18 + Math.random() * 8,
      angle: -50 + Math.random() * 20,
      delay: i * 55,
    }));
  } else {
    // Heal — floating plus signs
    return Array.from({ length: n }, (_, i): HealParticle => ({
      id: nextId++,
      kind: "heal",
      left: 15 + Math.random() * 65,
      bottom: 25 + Math.random() * 30,
      delay: i * 80,
    }));
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface PlayerPanelProps {
  player: Player;
  onLifeChange: (delta: number) => void;
  onCommanderDamage: (delta: number) => void;
  isRotated?: boolean;
  className?: string;
}

export default function PlayerPanel({
  player,
  onLifeChange,
  onCommanderDamage,
  isRotated = false,
  className,
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
      900
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

      {/* ── Particles ── */}
      {particles.map((p) => {
        if (p.kind === "slash") {
          return (
            <div
              key={p.id}
              aria-hidden
              className="pointer-events-none absolute left-[5%] right-[5%] z-20"
              style={{
                top: `${p.top}%`,
                height: "3px",
                transformOrigin: "left center",
                transform: `rotate(${p.angle}deg)`,
                background:
                  "linear-gradient(90deg, transparent 0%, #ff2222 20%, #ff6666 50%, #ff2222 80%, transparent 100%)",
                borderRadius: "2px",
                boxShadow: "0 0 6px 1px rgba(255,30,30,0.7)",
                animation: `life-slash 0.75s ease-out ${p.delay}ms both`,
              }}
            />
          );
        }

        // heal plus
        return (
          <div
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute z-20 text-base font-black leading-none select-none"
            style={{
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              color: "#22ff66",
              textShadow: "0 0 8px rgba(34,255,100,0.9), 0 0 16px rgba(34,255,100,0.5)",
              animation: `life-heal 0.85s ease-out ${p.delay}ms both`,
            }}
          >
            +
          </div>
        );
      })}

      {/* ── Top: player name ── */}
      <div className="relative z-10 flex items-center justify-center gap-2 pt-2 pb-0.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
        <span className="text-xs font-medium text-text-secondary">{player.name}</span>
      </div>

      {/* ── Middle: life total with + above and − below ── */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 min-h-0">
        <button
          onClick={() => onLifeChange(1)}
          className="flex items-center justify-center w-full py-1 text-3xl font-bold text-white/60 hover:text-white active:text-legal transition-colors"
          aria-label="Increase life"
        >
          +
        </button>
        <span
          className="text-6xl font-black tabular-nums drop-shadow-lg leading-none"
          style={{ color: player.color }}
        >
          {player.life}
        </span>
        <button
          onClick={() => onLifeChange(-1)}
          className="flex items-center justify-center w-full py-1 text-3xl font-bold text-white/60 hover:text-white active:text-banned transition-colors"
          aria-label="Decrease life"
        >
          −
        </button>
      </div>

      {/* ── Bottom: commander damage ── */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 pb-2">
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
    </div>
  );
}
