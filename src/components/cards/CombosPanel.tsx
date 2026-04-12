"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { EnrichedCombo, ComboCard } from "@/types/combo";

// ── Zone label helpers ───────────────────────────────────────────────────────

const ZONE_LABELS: Record<string, string> = {
  H: "Hand",
  B: "Battlefield",
  G: "Graveyard",
  E: "Exile",
  L: "Library",
  C: "Command",
};

function zoneLabel(zones: string[]): string {
  return zones.map((z) => ZONE_LABELS[z] ?? z).join(", ");
}

// ── Result badge colour map ──────────────────────────────────────────────────

function produceColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("win") || n.includes("lose"))       return "bg-banned/20 text-banned border-banned/30";
  if (n.includes("infinite") || n.includes("unbounded")) return "bg-accent/20 text-accent border-accent/30";
  if (n.includes("draw"))                              return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (n.includes("token") || n.includes("copy"))      return "bg-green-500/20 text-green-400 border-green-500/30";
  if (n.includes("damage") || n.includes("life"))     return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-bg-hover text-text-secondary border-border";
}

// ── Card thumbnail ───────────────────────────────────────────────────────────

function ComboCardThumb({ card, highlight }: { card: ComboCard; highlight: boolean }) {
  const imgUri = card.imageUri;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "w-14 rounded-lg overflow-hidden border-2 transition-all",
          highlight ? "border-accent shadow-[0_0_8px_rgba(237,154,87,0.5)]" : "border-border"
        )}
        style={{ aspectRatio: "488/680" }}
      >
        {imgUri ? (
          <img src={imgUri} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-bg-hover flex items-center justify-center">
            <span className="text-[8px] text-text-muted text-center px-1 leading-tight">{card.name}</span>
          </div>
        )}
      </div>
      <span className="text-[9px] text-text-muted text-center leading-tight max-w-[56px] truncate">
        {zoneLabel(card.zoneLocations)}
      </span>
      {card.mustBeCommander && (
        <span className="text-[8px] text-accent font-bold">CMDR</span>
      )}
    </div>
  );
}

// ── Single combo card ────────────────────────────────────────────────────────

function ComboRow({ combo, focusCardName }: { combo: EnrichedCombo; focusCardName: string }) {
  const [expanded, setExpanded] = useState(false);
  const steps = combo.description
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Card thumbnails */}
      <div className="flex items-end gap-2 px-3 pt-3 pb-2 overflow-x-auto">
        {combo.cards.map((c) => (
          <ComboCardThumb
            key={c.name}
            card={c}
            highlight={c.name.toLowerCase() === focusCardName.toLowerCase()}
          />
        ))}
      </div>

      {/* Result badges */}
      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {combo.produces.map((result) => (
          <span
            key={result}
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              produceColor(result)
            )}
          >
            {result}
          </span>
        ))}
      </div>

      {/* Expand / collapse steps */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      >
        <span className="font-medium">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
        <svg
          className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border">
          <ol className="space-y-1.5 mt-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-text-secondary leading-snug">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>
          {combo.notes && (
            <p className="text-[10px] text-text-muted italic mt-2 border-t border-border pt-2">
              {combo.notes}
            </p>
          )}
          {combo.popularity != null && (
            <p className="text-[10px] text-text-muted">
              Used in ~{combo.popularity.toLocaleString()} decks on EDHREC
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

interface CombosPanelProps {
  cardName: string;
  combos: EnrichedCombo[];
  count: number;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

export default function CombosPanel({
  cardName,
  combos,
  count,
  loading,
  error,
  loaded,
}: CombosPanelProps) {
  if (!loaded && !loading && !error) {
    // Idle — waiting for tab click to trigger load (parent calls load())
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <div className="w-8 h-8 border-2 border-border border-t-transparent rounded-full" />
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-muted">Searching Commander Spellbook…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-banned/10 border border-banned/20 rounded-lg p-3">
        <p className="text-sm text-banned">{error}</p>
      </div>
    );
  }

  if (loaded && combos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        <p className="text-sm font-medium text-text-secondary">No combos found</p>
        <p className="text-xs text-text-muted max-w-xs">
          {cardName} doesn&apos;t appear in any known Commander Spellbook combos yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loaded && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {count} combo{count !== 1 ? "s" : ""} found via{" "}
            <a
              href={`https://commanderspellbook.com/search/?q=card%3A"${encodeURIComponent(cardName)}"`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Commander Spellbook
            </a>
          </p>
          {count > combos.length && (
            <span className="text-xs text-text-muted">Showing top {combos.length}</span>
          )}
        </div>
      )}

      {combos.map((combo) => (
        <ComboRow key={combo.id} combo={combo} focusCardName={cardName} />
      ))}
    </div>
  );
}
