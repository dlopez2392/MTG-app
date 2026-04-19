"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import type { DeckCard } from "@/types/deck";

interface Props {
  open: boolean;
  onClose: () => void;
  cards: DeckCard[]; // all deck cards (we only use "main")
}

interface SimCard extends DeckCard {
  uid: string; // unique instance id (same card can appear multiple times)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildLibrary(cards: DeckCard[]): SimCard[] {
  const lib: SimCard[] = [];
  for (const c of cards) {
    if (c.category !== "main") continue;
    for (let i = 0; i < c.quantity; i++) {
      lib.push({ ...c, uid: `${c.scryfallId}-${i}` });
    }
  }
  return lib;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isLand(card: SimCard) {
  return (card.typeLine ?? "").toLowerCase().includes("land");
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function handStats(hand: SimCard[]) {
  const lands = hand.filter(isLand).length;
  const nonLands = hand.filter((c) => !isLand(c));
  const avgCmc =
    nonLands.length > 0
      ? nonLands.reduce((s, c) => s + (c.cmc ?? 0), 0) / nonLands.length
      : 0;
  return { lands, avgCmc };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HandSimulator({ open, onClose, cards }: Props) {
  const [library, setLibrary]           = useState<SimCard[]>([]);
  const [hand, setHand]                 = useState<SimCard[]>([]);
  const [mulligans, setMulligans]       = useState(0);
  // Cards selected to put back (London mulligan)
  const [putBack, setPutBack]           = useState<Set<string>>(new Set());
  const [phase, setPhase]               = useState<"hand" | "choosing">("hand");
  const [flipped, setFlipped]           = useState<Set<string>>(new Set());

  const deal7 = useCallback((lib: SimCard[]) => {
    const shuffled = shuffle(lib);
    setHand(shuffled.slice(0, 7));
    setLibrary(shuffled.slice(7));
    setPutBack(new Set());
    setFlipped(new Set());
    setPhase("hand");
  }, []);

  // Draw fresh hand on open
  useEffect(() => {
    if (open) {
      setMulligans(0);
      deal7(buildLibrary(cards));
    }
  }, [open, cards, deal7]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const mainCount = cards.filter((c) => c.category === "main").reduce((s, c) => s + c.quantity, 0);
  const stats = handStats(hand);
  const putBackTarget = mulligans + 1; // London: put back N cards where N = mulligans AFTER this one

  // ── Actions ──────────────────────────────────────────────────────────────

  function handleNewHand() {
    setMulligans(0);
    deal7(buildLibrary(cards));
  }

  function handleStartMulligan() {
    // Enter "choosing" phase — user picks putBackTarget cards to put back
    setPhase("choosing");
    setPutBack(new Set());
  }

  function togglePutBack(uid: string) {
    if (phase !== "choosing") return;
    setPutBack((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else if (next.size < putBackTarget) {
        next.add(uid);
      }
      return next;
    });
  }

  function confirmMulligan() {
    // Put selected cards back, draw 7 new from reshuffled library
    const kept = hand.filter((c) => !putBack.has(c.uid));
    const returned = hand.filter((c) => putBack.has(c.uid));
    const newLib = shuffle([...library, ...returned]);
    const drawn = newLib.slice(0, 7 - kept.length);
    const newHand = shuffle([...kept, ...drawn]);
    setLibrary(newLib.slice(7 - kept.length));
    setHand(newHand);
    setMulligans((m) => m + 1);
    setPutBack(new Set());
    setFlipped(new Set());
    setPhase("hand");
  }

  function handleDraw() {
    if (library.length === 0) return;
    setHand((h) => [...h, library[0]]);
    setLibrary((l) => l.slice(1));
  }

  function toggleFlip(uid: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 z-[90]" onClick={phase === "hand" ? onClose : undefined} />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 top-0 z-[91] flex flex-col bg-bg-primary overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <h2 className="text-sm font-bold text-text-primary">Opening Hand</h2>
            <p className="text-xs text-text-muted">{mainCount} cards · {library.length} in library</p>
          </div>
          <button
            onClick={handleNewHand}
            className="p-1 text-text-muted hover:text-accent transition-colors"
            title="New game"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {/* Mulligan instruction */}
        {phase === "choosing" && (
          <div className="px-4 py-2 bg-accent/10 border-b border-accent/20 text-center shrink-0">
            <p className="text-xs font-semibold text-accent">
              Select {putBackTarget - putBack.size} more card{putBackTarget - putBack.size !== 1 ? "s" : ""} to put back
              {putBack.size === putBackTarget && " — tap Confirm"}
            </p>
          </div>
        )}

        {/* Mulligans taken badge */}
        {mulligans > 0 && phase === "hand" && (
          <div className="px-4 pt-2 shrink-0">
            <div className="flex justify-center">
              <span className="px-2.5 py-0.5 rounded-full bg-bg-card border border-border text-xs text-text-muted">
                {mulligans} mulligan{mulligans !== 1 ? "s" : ""} taken
              </span>
            </div>
          </div>
        )}

        {/* Card hand */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Cards grid — 4 cols so they fit nicely */}
          <div className="grid grid-cols-4 gap-2">
            {hand.map((card) => {
              const selected = putBack.has(card.uid);
              const isFlipped = flipped.has(card.uid);
              const land = isLand(card);

              return (
                <button
                  key={card.uid}
                  onClick={() => phase === "choosing" ? togglePutBack(card.uid) : toggleFlip(card.uid)}
                  className={cn(
                    "relative rounded-lg overflow-hidden border-2 transition-all active:scale-95",
                    selected
                      ? "border-accent opacity-50 scale-95"
                      : "border-transparent",
                    phase === "choosing" && !selected && putBack.size >= putBackTarget
                      ? "opacity-40"
                      : ""
                  )}
                  style={{ aspectRatio: "488/680" }}
                >
                  {card.imageUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.imageUri}
                      alt={card.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className={cn(
                      "w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-center",
                      land ? "bg-mtg-green/20" : "bg-bg-card"
                    )}>
                      <p className="text-[9px] font-semibold text-text-primary leading-tight line-clamp-3">{card.name}</p>
                      {card.cmc !== undefined && !land && (
                        <span className="text-[8px] text-text-muted">{card.cmc} CMC</span>
                      )}
                    </div>
                  )}

                  {/* Land indicator */}
                  {land && (
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-mtg-green/80 border border-white/30" />
                  )}

                  {/* Selected overlay */}
                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}

                  {/* Flipped — show card name overlay */}
                  {isFlipped && phase === "hand" && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-1 text-center">
                      <p className="text-[9px] font-semibold text-white leading-tight">{card.name}</p>
                      {card.typeLine && (
                        <p className="text-[8px] text-text-muted mt-0.5 leading-tight line-clamp-2">{card.typeLine}</p>
                      )}
                      {card.cmc !== undefined && (
                        <p className="text-[8px] text-accent mt-0.5">{card.cmc} CMC</p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 py-2 border-t border-border shrink-0">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-mtg-green" />
              <span className="text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{stats.lands}</span> land{stats.lands !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-xs text-text-secondary">
              Avg CMC: <span className="font-semibold text-text-primary">{stats.avgCmc.toFixed(1)}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-xs text-text-secondary">
              {hand.length} cards
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 flex gap-2 border-t border-border shrink-0">
          {phase === "hand" ? (
            <>
              <button
                onClick={handleDraw}
                disabled={library.length === 0}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Draw
              </button>
              <button
                onClick={handleStartMulligan}
                disabled={mainCount < 7}
                className="flex-1 py-2.5 rounded-xl border border-accent/50 text-sm font-semibold text-accent hover:bg-accent/10 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Mulligan
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98]"
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setPutBack(new Set()); setPhase("hand"); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={confirmMulligan}
                disabled={putBack.size < putBackTarget}
                className="flex-1 py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Confirm ({putBack.size}/{putBackTarget})
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
