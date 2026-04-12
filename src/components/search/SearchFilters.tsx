"use client";

import { useState } from "react";
import type { SearchFilters, Color, StatComparison } from "@/types/card";
import { cn } from "@/lib/utils/cn";
import { MTG_COLORS, RARITIES } from "@/lib/constants";

// ── constants ────────────────────────────────────────────────────────────────

const PRIMARY_FORMATS = [
  { value: "standard",  label: "Standard" },
  { value: "pioneer",   label: "Pioneer" },
  { value: "modern",    label: "Modern" },
  { value: "legacy",    label: "Legacy" },
  { value: "commander", label: "Commander" },
  { value: "vintage",   label: "Vintage" },
  { value: "pauper",    label: "Pauper" },
  { value: "historic",  label: "Historic" },
  { value: "brawl",     label: "Brawl" },
] as const;

const EXTRA_FORMATS = [
  { value: "explorer",  label: "Explorer" },
  { value: "oathbreaker", label: "Oathbreaker" },
  { value: "timeless",  label: "Timeless" },
  { value: "alchemy",   label: "Alchemy" },
  { value: "penny",     label: "Penny" },
] as const;

const CARD_TYPES = ["Creature","Instant","Sorcery","Enchantment","Artifact","Planeswalker","Land","Battle"] as const;
const SUPERTYPES = ["Legendary","Basic","Snow","World","Ongoing"] as const;
const COMPARISONS: StatComparison[] = ["=", "<=", ">=", "<", ">"];

// ── helpers ──────────────────────────────────────────────────────────────────

function countActiveFilters(f: SearchFilters): number {
  let n = 0;
  if (f.colors.length)  n++;
  if (f.format)         n++;
  if (f.rarity)         n++;
  if (f.type)           n++;
  if (f.supertype)      n++;
  if (f.subtype)        n++;
  if (f.cmc)            n++;
  if (f.power)          n++;
  if (f.toughness)      n++;
  if (f.oracleText)     n++;
  if (f.manaCost)       n++;
  return n;
}

// ── sub-pieces ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{children}</p>;
}

function ComparisonSelect({ value, onChange }: { value: StatComparison; onChange: (v: StatComparison) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as StatComparison)}
      className="h-8 rounded-lg border border-border bg-bg-card px-1.5 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
    >
      {COMPARISONS.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function StatRow({
  label, value, comparison,
  onValue, onComparison,
}: {
  label: string;
  value: string;
  comparison: StatComparison;
  onValue: (v: string) => void;
  onComparison: (v: StatComparison) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary w-20 shrink-0">{label}</span>
      <ComparisonSelect value={comparison} onChange={onComparison} />
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder="—"
        className="h-8 flex-1 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
      />
      {value && (
        <button onClick={() => onValue("")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
      )}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  className?: string;
}

export default function SearchFiltersPanel({ filters, onChange, className }: SearchFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMoreFormats, setShowMoreFormats] = useState(false);

  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount = countActiveFilters(filters);

  const toggleColor = (code: Color) =>
    set("colors", filters.colors.includes(code)
      ? filters.colors.filter((c) => c !== code)
      : [...filters.colors, code]);

  const toggleFormat = (value: string) =>
    set("format", filters.format === value ? "" : value as SearchFilters["format"]);

  const toggleRarity = (value: string) =>
    set("rarity", filters.rarity === value ? "" : value as SearchFilters["rarity"]);

  const clearAll = () => {
    onChange({
      ...filters,
      colors: [], colorMode: "include",
      format: "", rarity: "", type: "", supertype: "", subtype: "",
      cmc: "", cmcComparison: "<=",
      power: "", powerComparison: ">=",
      toughness: "", toughnessComparison: ">=",
      oracleText: "", manaCost: "",
    });
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Toggle bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-black text-[10px] font-bold">
              {activeCount}
            </span>
          )}
          <svg
            className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-text-muted hover:text-banned transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Panel */}
      {expanded && (
        <div className="mt-3 rounded-xl border border-border bg-bg-secondary divide-y divide-border">

          {/* ── Colors ── */}
          <div className="p-4 space-y-3">
            <SectionLabel>Colors</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              {MTG_COLORS.map(({ code, name, bg }) => {
                const sel = filters.colors.includes(code as Color);
                return (
                  <button
                    key={code}
                    title={name}
                    onClick={() => toggleColor(code as Color)}
                    className={cn(
                      "w-9 h-9 rounded-full border-2 text-xs font-bold transition-all",
                      sel ? "border-accent scale-110 shadow-lg" : "border-border opacity-50 hover:opacity-80"
                    )}
                    style={{ backgroundColor: sel ? bg : `${bg}33`, color: code === "W" ? "#1a1a1a" : "#fff" }}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            {/* Color mode */}
            <div className="flex gap-1">
              {(["include","exact","at_most"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => set("colorMode", mode)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                    filters.colorMode === mode
                      ? "bg-accent/20 border-accent text-accent"
                      : "border-border text-text-muted hover:text-text-primary"
                  )}
                >
                  {mode === "include" ? "Includes" : mode === "exact" ? "Exactly" : "At most"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Legality / Format ── */}
          <div className="p-4">
            <SectionLabel>Legality</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {PRIMARY_FORMATS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleFormat(value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    filters.format === value
                      ? "bg-legal/20 border-legal text-legal"
                      : "border-border text-text-secondary hover:text-text-primary hover:border-accent/40"
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setShowMoreFormats((p) => !p)}
                className="px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                {showMoreFormats ? "Less ▲" : "More ▼"}
              </button>
            </div>
            {showMoreFormats && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXTRA_FORMATS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleFormat(value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      filters.format === value
                        ? "bg-legal/20 border-legal text-legal"
                        : "border-border text-text-secondary hover:text-text-primary hover:border-accent/40"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Rarity ── */}
          <div className="p-4">
            <SectionLabel>Rarity</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {RARITIES.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => toggleRarity(value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    filters.rarity === value
                      ? "border-current bg-bg-card"
                      : "border-border text-text-secondary hover:text-text-primary"
                  )}
                  style={filters.rarity === value ? { color, borderColor: color } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Type line ── */}
          <div className="p-4 space-y-2">
            <SectionLabel>Type Line</SectionLabel>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary w-20 shrink-0">Supertype</span>
              <div className="flex-1 relative">
                <input
                  value={filters.supertype}
                  onChange={(e) => set("supertype", e.target.value)}
                  placeholder="e.g. Legendary"
                  list="supertypes-list"
                  className="w-full h-8 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <datalist id="supertypes-list">
                  {SUPERTYPES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              {filters.supertype && (
                <button onClick={() => set("supertype", "")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary w-20 shrink-0">Type</span>
              <div className="flex-1 relative">
                <input
                  value={filters.type}
                  onChange={(e) => set("type", e.target.value)}
                  placeholder="e.g. Creature"
                  list="types-list"
                  className="w-full h-8 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <datalist id="types-list">
                  {CARD_TYPES.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              {filters.type && (
                <button onClick={() => set("type", "")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary w-20 shrink-0">Subtype</span>
              <input
                value={filters.subtype}
                onChange={(e) => set("subtype", e.target.value)}
                placeholder="e.g. Angel, Wizard"
                className="flex-1 h-8 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              {filters.subtype && (
                <button onClick={() => set("subtype", "")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="p-4 space-y-2">
            <SectionLabel>Stats</SectionLabel>
            <StatRow
              label="Mana Value"
              value={filters.cmc}
              comparison={filters.cmcComparison}
              onValue={(v) => set("cmc", v)}
              onComparison={(v) => set("cmcComparison", v)}
            />
            <StatRow
              label="Power"
              value={filters.power}
              comparison={filters.powerComparison}
              onValue={(v) => set("power", v)}
              onComparison={(v) => set("powerComparison", v)}
            />
            <StatRow
              label="Toughness"
              value={filters.toughness}
              comparison={filters.toughnessComparison}
              onValue={(v) => set("toughness", v)}
              onComparison={(v) => set("toughnessComparison", v)}
            />
          </div>

          {/* ── Oracle Text ── */}
          <div className="p-4">
            <SectionLabel>Oracle Text</SectionLabel>
            <div className="flex items-center gap-2">
              <input
                value={filters.oracleText}
                onChange={(e) => set("oracleText", e.target.value)}
                placeholder="e.g. flying, draw a card"
                className="flex-1 h-9 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              {filters.oracleText && (
                <button onClick={() => set("oracleText", "")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
          </div>

          {/* ── Mana Cost ── */}
          <div className="p-4">
            <SectionLabel>Mana Cost</SectionLabel>
            <div className="flex items-center gap-2">
              <input
                value={filters.manaCost}
                onChange={(e) => set("manaCost", e.target.value)}
                placeholder="e.g. {2}{G}{W} or 2GW"
                className="flex-1 h-9 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent transition-colors"
              />
              {filters.manaCost && (
                <button onClick={() => set("manaCost", "")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
