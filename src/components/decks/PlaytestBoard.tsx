"use client";

import { cn } from "@/lib/utils/cn";
import {
  isLand,
  type BoardCard,
  type GoldfishAction,
  type GoldfishState,
  type SimCard,
} from "@/lib/utils/goldfish";

interface Props {
  board: GoldfishState;
  dispatch: (action: GoldfishAction) => void;
}

export default function PlaytestBoard({ board, dispatch }: Props) {
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Zone strip */}
      <div className="px-4 py-1.5 border-t border-border flex items-center gap-2 shrink-0">
        <ZoneChip label="Graveyard" count={board.graveyard.length} />
        <ZoneChip label="Exile" count={board.exile.length} />
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
    </div>
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

function BattlefieldCard({ card, onTap }: { card: BoardCard; onTap: () => void }) {
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
    </div>
  );
}

function HandCard({ card, onPlay }: { card: SimCard; onPlay: () => void }) {
  return (
    <div className="relative shrink-0 w-16" style={{ aspectRatio: "488/680" }}>
      <button
        onClick={onPlay}
        aria-label={`Play ${card.name}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
    </div>
  );
}

function ZoneChip({ label, count }: { label: string; count: number }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full bg-bg-card border border-border text-xs text-text-muted">
      {label}: <span className="font-semibold text-text-primary">{count}</span>
    </span>
  );
}
