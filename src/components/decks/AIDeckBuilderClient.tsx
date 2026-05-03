"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import { useDecks } from "@/hooks/useDecks";
import type { ScryfallCard } from "@/types/card";

interface ValidatedCard {
  scryfallId: string;
  name: string;
  quantity: number;
  category: string;
  reason: string;
  manaCost?: string;
  cmc: number;
  typeLine: string;
  rarity: string;
  colors?: string[];
  imageUri?: string;
  priceUsd: string | null;
  priceTotal: number;
}

interface DeckResult {
  deckName: string;
  strategy: string;
  commander?: string;
  cards: ValidatedCard[];
  notFound: string[];
  totalPrice: number;
  budgetTips?: string;
  keyCards: string[];
  gameplan: string[];
  cardCount: number;
}

const FORMAT_OPTIONS = [
  { value: "commander", label: "Commander / EDH" },
  { value: "standard", label: "Standard" },
  { value: "modern", label: "Modern" },
  { value: "pioneer", label: "Pioneer" },
  { value: "pauper", label: "Pauper" },
  { value: "legacy", label: "Legacy" },
];

const CATEGORY_ORDER = ["commander", "creature", "instant", "sorcery", "artifact", "enchantment", "planeswalker", "land"];

function groupByCategory(cards: ValidatedCard[]) {
  const groups = new Map<string, ValidatedCard[]>();
  for (const card of cards) {
    const cat = card.category || "other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(card);
  }
  return CATEGORY_ORDER
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, cards: groups.get(cat)! }))
    .concat(
      [...groups.entries()]
        .filter(([cat]) => !CATEGORY_ORDER.includes(cat))
        .map(([category, cards]) => ({ category, cards }))
    );
}

export default function AIDeckBuilderClient() {
  const router = useRouter();
  const { createDeck, addCardToDeck } = useDecks();

  const [format, setFormat] = useState("commander");
  const [commander, setCommander] = useState("");
  const [budget, setBudget] = useState("");
  const [strategy, setStrategy] = useState("");
  const [colors, setColors] = useState("");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commanderRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/scryfall/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.data ?? []);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 200);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (commanderRef.current && !commanderRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [result, setResult] = useState<DeckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const buildDeck = async () => {
    if (!strategy.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedDeckId(null);

    try {
      const res = await fetch("/api/ai-deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          commander: format === "commander" ? commander : undefined,
          budget: budget ? parseInt(budget) : undefined,
          strategy,
          colors: colors || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build deck");
    } finally {
      setLoading(false);
    }
  };

  const saveDeck = async () => {
    if (!result || saving) return;
    setSaving(true);

    try {
      const deckId = await createDeck(result.deckName, format);

      for (const card of result.cards) {
        const categoryMap: Record<string, string> = {
          commander: "commander",
          creature: "main",
          instant: "main",
          sorcery: "main",
          artifact: "main",
          enchantment: "main",
          planeswalker: "main",
          land: "main",
        };

        const scryfallPartial: Partial<ScryfallCard> = {
          id: card.scryfallId,
          name: card.name,
          mana_cost: card.manaCost,
          cmc: card.cmc,
          type_line: card.typeLine,
          rarity: card.rarity as ScryfallCard["rarity"],
          image_uris: card.imageUri ? { normal: card.imageUri } as ScryfallCard["image_uris"] : undefined,
          prices: { usd: card.priceUsd } as ScryfallCard["prices"],
        };

        await addCardToDeck(
          deckId,
          scryfallPartial,
          (categoryMap[card.category] ?? "main") as "main" | "commander" | "sideboard",
          card.quantity
        );
      }

      setSavedDeckId(deckId);
    } catch {
      setError("Failed to save deck");
    } finally {
      setSaving(false);
    }
  };

  const groups = result ? groupByCategory(result.cards) : [];

  return (
    <>
      <TopBar title="AI Deck Builder" showBack />
      <PageContainer>
        <div className="flex flex-col gap-4 pb-8">

          {!result && !loading && (
            <section
              className="rounded-2xl p-[1px] overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.05))" }}
            >
              <div
                className="rounded-2xl p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(15,15,25,0.95) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
                }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.1))" }}
                  >
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Build a Deck with AI</h2>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Format */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1 block">Format</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full input-base px-3 py-2.5 text-sm"
                    >
                      {FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Commander (only for Commander format) */}
                  {format === "commander" && (
                    <div ref={commanderRef} className="relative">
                      <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1 block">Commander</label>
                      <input
                        type="text"
                        value={commander}
                        onChange={(e) => {
                          setCommander(e.target.value);
                          fetchSuggestions(e.target.value);
                        }}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        placeholder="e.g. Atraxa, Praetors' Voice"
                        className="w-full input-base px-3 py-2.5 text-sm"
                        autoComplete="off"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div
                          className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border shadow-xl"
                          style={{ background: "rgba(20,20,30,0.98)", backdropFilter: "blur(12px)" }}
                        >
                          {suggestions.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setCommander(name);
                                setShowSuggestions(false);
                                setSuggestions([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white/90 transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Strategy */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1 block">Strategy / Theme</label>
                    <textarea
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                      placeholder="e.g. Voltron equipment deck, aggressive tokens, graveyard recursion..."
                      rows={3}
                      className="w-full input-base px-3 py-2.5 text-sm resize-none"
                    />
                  </div>

                  {/* Colors */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1 block">Colors (optional)</label>
                    <input
                      type="text"
                      value={colors}
                      onChange={(e) => setColors(e.target.value)}
                      placeholder="e.g. Blue/Black, Golgari, WUBRG"
                      className="w-full input-base px-3 py-2.5 text-sm"
                    />
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1 block">Budget (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="Max total deck price"
                        className="w-full input-base pl-7 pr-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={buildDeck}
                    disabled={!strategy.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none mt-1"
                    style={{
                      background: "linear-gradient(135deg, rgba(34,197,94,0.5), rgba(16,185,129,0.5))",
                      boxShadow: "0 4px 16px rgba(34,197,94,0.2)",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Build Deck
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Loading */}
          {loading && (
            <section
              className="rounded-2xl p-[1px] overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.05))" }}
            >
              <div
                className="rounded-2xl p-8 flex flex-col items-center gap-4"
                style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(15,15,25,0.95) 100%)" }}
              >
                <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm text-white/60">Building your deck...</p>
                  <p className="text-xs text-white/30 mt-1">Generating cards and validating with Scryfall</p>
                </div>
              </div>
            </section>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={() => { setError(null); setResult(null); }} className="mt-2 text-xs text-accent underline">Try again</button>
            </div>
          )}

          {/* Result */}
          {result && (
            <>
              {/* Header */}
              <section
                className="rounded-2xl p-[1px] overflow-hidden"
                style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.05))" }}
              >
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: "linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(15,15,25,0.95) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                >
                  <h2 className="text-lg font-bold text-white/90 mb-1">{result.deckName}</h2>
                  <p className="text-sm text-white/50 leading-relaxed mb-3">{result.strategy}</p>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">
                      {result.cardCount} cards
                    </span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
                      ${result.totalPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-white/30 capitalize">{format}</span>
                    {result.notFound.length > 0 && (
                      <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-lg">
                        {result.notFound.length} not found
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* Gameplan */}
              {result.gameplan.length > 0 && (
                <section className="rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))" }}>
                  <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)" }}>
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Gameplan</h3>
                    <div className="flex flex-col gap-2">
                      {result.gameplan.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs font-bold text-accent flex-shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-white/60 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Card Groups */}
              {groups.map(({ category, cards }) => (
                <section key={category} className="rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))" }}>
                  <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider capitalize">{category}s</h3>
                      <span className="text-xs text-white/30">{cards.reduce((s, c) => s + c.quantity, 0)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {cards.map((card, i) => {
                        const globalIdx = result.cards.indexOf(card);
                        const expanded = expandedCard === globalIdx;
                        return (
                          <button
                            key={i}
                            onClick={() => setExpandedCard(expanded ? null : globalIdx)}
                            className="w-full text-left rounded-lg px-3 py-2 transition-all"
                            style={{ background: expanded ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)" }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-xs text-white/30 w-4 text-right flex-shrink-0">{card.quantity}x</span>
                                <span className="text-sm text-white/80 truncate">{card.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {card.manaCost && (
                                  <span className="text-[10px] text-white/25">{card.manaCost}</span>
                                )}
                                {card.priceUsd && (
                                  <span className="text-[10px] text-amber-400/70 tabular-nums">${card.priceUsd}</span>
                                )}
                              </div>
                            </div>
                            {expanded && (
                              <div className="mt-2 pt-2 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                                <p className="text-xs text-white/40">{card.typeLine}</p>
                                {card.reason && <p className="text-xs text-white/50 mt-1 italic">{card.reason}</p>}
                                {card.imageUri && (
                                  <img
                                    src={card.imageUri}
                                    alt={card.name}
                                    className="mt-2 rounded-lg w-full max-w-[250px]"
                                    loading="lazy"
                                  />
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ))}

              {/* Not Found */}
              {result.notFound.length > 0 && (
                <section className="rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))" }}>
                  <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)" }}>
                    <h3 className="text-xs font-semibold text-red-400/70 uppercase tracking-wider mb-2">Cards Not Found on Scryfall</h3>
                    <div className="flex flex-col gap-1">
                      {result.notFound.map((name, i) => (
                        <p key={i} className="text-xs text-red-400/60">{name}</p>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Budget Tips */}
              {result.budgetTips && (
                <section className="rounded-2xl p-[1px] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))" }}>
                  <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85) 0%, rgba(15,15,25,0.95) 100%)" }}>
                    <h3 className="text-xs font-semibold text-amber-400/70 uppercase tracking-wider mb-1">Budget Tips</h3>
                    <p className="text-xs text-white/50 leading-relaxed">{result.budgetTips}</p>
                  </div>
                </section>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {savedDeckId ? (
                  <button
                    onClick={() => router.push(`/decks/${savedDeckId}`)}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, rgba(124,92,252,0.5), rgba(99,102,241,0.5))",
                      boxShadow: "0 4px 16px rgba(124,92,252,0.2)",
                    }}
                  >
                    View Saved Deck
                  </button>
                ) : (
                  <button
                    onClick={saveDeck}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, rgba(34,197,94,0.5), rgba(16,185,129,0.5))",
                      boxShadow: "0 4px 16px rgba(34,197,94,0.2)",
                    }}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Save as Deck
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => { setResult(null); setExpandedCard(null); setSavedDeckId(null); }}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors text-center py-2"
                >
                  Build another deck
                </button>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </>
  );
}
