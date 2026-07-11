"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  isLand,
  type BoardCard,
  type GoldfishAction,
  type GoldfishState,
  type SimCard,
  type Zone,
} from "@/lib/utils/goldfish";

interface Props {
  board: GoldfishState;
  dispatch: (action: GoldfishAction) => void;
}

interface Selected {
  card: SimCard;
  zone: Zone;
}

const MOVE_TARGETS: { to: Zone; label: string }[] = [
  { to: "battlefield", label: "To Battlefield" },
  { to: "hand",        label: "To Hand" },
  { to: "graveyard",   label: "To Graveyard" },
  { to: "exile",       label: "To Exile" },
  { to: "library",     label: "Top of Library" },
];

export default function PlaytestBoard({ board, dispatch }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [viewZone, setViewZone] = useState<"graveyard" | "exile" | null>(null);

  function moveSelected(to: Zone) {
    if (!selected) return;
    dispatch({ type: "MOVE", uid: selected.card.uid, from: selected.zone, to });
    setSelected(null);
    setViewZone(null);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* Battlefield */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {board.battlefield.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-text-muted text-center px-8">
              Tap a card in your hand to play it
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {board.battlefield.map((card) => (
              <BattlefieldCard
                key={card.uid}
                card={card}
                onTap={() => dispatch({ type: "TOGGLE_TAP", uid: card.uid })}
                onMenu={() => setSelected({ card, zone: "battlefield" })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zone strip */}
      <div className="px-4 py-1.5 border-t border-border flex items-center gap-2 shrink-0">
        <ZoneChip label="Graveyard" count={board.graveyard.length} onClick={() => setViewZone("graveyard")} />
        <ZoneChip label="Exile" count={board.exile.length} onClick={() => setViewZone("exile")} />
        <span className="ml-auto text-xs text-text-muted">{board.hand.length} in hand</span>
      </div>

      {/* Hand */}
      <div className="border-t border-border shrink-0">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto">
          {board.hand.length === 0 ? (
            <p className="text-xs text-text-muted py-4 mx-auto">Hand is empty</p>
          ) : (
            board.hand.map((card) => (
              <HandCard
                key={card.uid}
                card={card}
                onPlay={() => dispatch({ type: "MOVE", uid: card.uid, from: "hand", to: "battlefield" })}
                onMenu={() => setSelected({ card, zone: "hand" })}
              />
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 flex gap-2 border-t border-border shrink-0">
        <button
          onClick={() => dispatch({ type: "DRAW" })}
          disabled={board.library.length === 0}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          Draw
        </button>
        <button
          onClick={() => dispatch({ type: "NEXT_TURN" })}
          className="flex-[2] py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98]"
        >
          Next Turn
        </button>
      </div>

      {/* Zone viewer sheet */}
      {viewZone && !selected && (
        <Sheet onClose={() => setViewZone(null)} title={viewZone === "graveyard" ? "Graveyard" : "Exile"}>
          {board[viewZone].length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">Empty</p>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto">
              {board[viewZone].map((card) => (
                <li key={card.uid}>
                  <button
                    onClick={() => setSelected({ card, zone: viewZone })}
                    className="w-full flex items-center gap-3 px-1 py-2 text-left hover:bg-bg-hover rounded-lg transition-colors"
                  >
                    <div className="w-8 shrink-0 rounded overflow-hidden" style={{ aspectRatio: "488/680" }}>
                      <CardFace card={card} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{card.name}</p>
                      {card.typeLine && (
                        <p className="text-xs text-text-muted truncate">{card.typeLine}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {/* Card action sheet */}
      {selected && (
        <Sheet onClose={() => setSelected(null)} title={selected.card.name}>
          {(selected.card.typeLine || selected.card.cmc !== undefined) && (
            <p className="text-xs text-text-muted -mt-2 mb-3">
              {selected.card.typeLine}
              {selected.card.typeLine && selected.card.cmc !== undefined && " · "}
              {selected.card.cmc !== undefined && `${selected.card.cmc} CMC`}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {selected.zone === "battlefield" && (
              <button
                onClick={() => {
                  dispatch({ type: "TOGGLE_TAP", uid: selected.card.uid });
                  setSelected(null);
                }}
                className="w-full py-2.5 rounded-xl border border-accent/50 text-sm font-semibold text-accent hover:bg-accent/10 transition-all active:scale-[0.98]"
              >
                {board.battlefield.find((c) => c.uid === selected.card.uid)?.tapped ? "Untap" : "Tap"}
              </button>
            )}
            {MOVE_TARGETS.filter((t) => t.to !== selected.zone).map((t) => (
              <button
                key={t.to}
                onClick={() => moveSelected(t.to)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ── Bottom sheet ─────────────────────────────────────────────────────────────

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[109]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-[110] bg-bg-card border-t border-border rounded-t-2xl px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-sheet-up"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-primary truncate pr-2">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ── Card faces ────────────────────────────────────────────────────────────────

function CardFace({ card }: { card: SimCard }) {
  const land = isLand(card);
  if (card.imageUri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.imageUri} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
    );
  }
  return (
    <div className={cn(
      "w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-center",
      land ? "bg-mtg-green/20" : "bg-bg-card"
    )}>
      <p className="text-[9px] font-semibold text-text-primary leading-tight line-clamp-3">{card.name}</p>
      {card.cmc !== undefined && !land && (
        <span className="text-[8px] text-text-muted">{card.cmc} CMC</span>
      )}
    </div>
  );
}

function MenuButton({ name, onMenu }: { name: string; onMenu: () => void }) {
  return (
    <button
      onClick={onMenu}
      aria-label={`Actions for ${name}`}
      className="absolute top-0.5 right-0.5 z-10 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] leading-none flex items-center justify-center"
    >
      ⋯
    </button>
  );
}

function BattlefieldCard({ card, onTap, onMenu }: { card: BoardCard; onTap: () => void; onMenu: () => void }) {
  return (
    <div
      className={cn("relative transition-transform", card.tapped && "rotate-90 scale-[0.72]")}
      style={{ aspectRatio: "488/680" }}
    >
      <button
        onClick={onTap}
        aria-pressed={card.tapped}
        aria-label={`${card.name}${card.tapped ? " (tapped)" : ""}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
      <MenuButton name={card.name} onMenu={onMenu} />
    </div>
  );
}

function HandCard({ card, onPlay, onMenu }: { card: SimCard; onPlay: () => void; onMenu: () => void }) {
  return (
    <div className="relative shrink-0 w-16" style={{ aspectRatio: "488/680" }}>
      <button
        onClick={onPlay}
        aria-label={`Play ${card.name}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
      <MenuButton name={card.name} onMenu={onMenu} />
    </div>
  );
}

function ZoneChip({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-0.5 rounded-full bg-bg-card border border-border text-xs text-text-muted hover:border-accent/40 hover:text-text-primary transition-colors active:scale-[0.97]"
    >
      {label}: <span className="font-semibold text-text-primary">{count}</span>
    </button>
  );
}
