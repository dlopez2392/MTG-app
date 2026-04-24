"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrades } from "@/hooks/useTrades";
import type { Trade, TradeCard } from "@/types/trade";

function formatDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function groupByWeek(trades: Trade[]) {
  const now = Date.now();
  const day = 86400000;
  const groups: { label: string; trades: Trade[] }[] = [];
  const map = new Map<string, Trade[]>();

  for (const t of trades) {
    const diff = now - new Date(t.date).getTime();
    let label: string;
    if (diff < 7 * day) label = "This week";
    else if (diff < 14 * day) label = "Last week";
    else if (diff < 30 * day) label = "This month";
    else label = new Date(t.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(t);
  }
  for (const [label, trades] of map) groups.push({ label, trades });
  return groups;
}

function sumTotal(cards: TradeCard[]) {
  return cards.reduce((s, c) => s + (c.priceUsd ?? 0) * c.quantity, 0);
}

interface CardSearchResult {
  id: string;
  name: string;
  set: string;
  set_name: string;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
  prices: { usd?: string | null; usd_foil?: string | null };
}

function CardSearchModal({ onAdd, onClose }: { onAdd: (card: TradeCard) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=name&unique=prints`)
        .then((r) => r.json())
        .then((data) => { if (data.data) setResults(data.data.slice(0, 20)); })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handlePick(card: CardSearchResult, foil: boolean) {
    const img = card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? "";
    const price = foil ? parseFloat(card.prices.usd_foil ?? "0") : parseFloat(card.prices.usd ?? "0");
    onAdd({
      scryfallId: card.id,
      name: card.name,
      setCode: card.set,
      setName: card.set_name,
      imageUri: img,
      priceUsd: price || null,
      quantity: 1,
      foil,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center pt-[env(safe-area-inset-top)]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[80vh] bg-bg-card border border-border sm:rounded-2xl flex flex-col overflow-hidden sm:mx-4 sm:my-8" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0">
          <svg className="w-5 h-5 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a card..."
            className="flex-1 bg-transparent text-text-primary text-base outline-none placeholder:text-text-muted"
          />
          <button onClick={onClose} className="text-accent hover:text-text-primary text-sm font-semibold px-2 py-1">Cancel</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain">
          {searching && <p className="text-center text-text-muted text-sm py-6">Searching...</p>}
          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-text-muted text-sm py-6">No cards found</p>
          )}
          {results.map((card) => {
            const img = card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small;
            const price = card.prices.usd;
            const foilPrice = card.prices.usd_foil;
            return (
              <div
                key={card.id}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
                onClick={() => handlePick(card, false)}
              >
                {img && <img src={img} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium truncate">{card.name}</p>
                  <p className="text-xs text-text-muted truncate">{card.set_name}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {price && (
                    <button
                      type="button"
                      onClick={() => handlePick(card, false)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 active:bg-emerald-500/35 transition-colors"
                    >
                      ${price}
                    </button>
                  )}
                  {foilPrice && (
                    <button
                      type="button"
                      onClick={() => handlePick(card, true)}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-xs font-semibold hover:bg-purple-500/25 active:bg-purple-500/35 transition-colors"
                    >
                      ${foilPrice} <span className="opacity-60">F</span>
                    </button>
                  )}
                  {!price && !foilPrice && (
                    <button
                      type="button"
                      onClick={() => handlePick(card, false)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-text-muted text-xs font-semibold hover:bg-white/15 active:bg-white/20 transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

function TradeSide({ label, cards, onAdd, onRemove, onQuantity, total, accentColor }: {
  label: string;
  cards: TradeCard[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onQuantity: (idx: number, qty: number) => void;
  total: number;
  accentColor: string;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: accentColor }}>{label}</p>
        <p className="text-sm font-bold text-text-primary">${total.toFixed(2)}</p>
      </div>
      <div className="flex-1 space-y-2 min-h-[60px]">
        {cards.length === 0 && (
          <p className="text-center text-text-muted text-xs py-6 opacity-60">No cards yet</p>
        )}
        {cards.map((c, i) => (
          <div key={`${c.scryfallId}-${i}`} className="group flex items-center gap-3 bg-white/5 rounded-xl p-2.5 hover:bg-white/8 transition-colors">
            {c.imageUri && <img src={c.imageUri} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium truncate leading-tight">{c.name}</p>
              <p className="text-xs text-text-muted truncate">{c.setName}{c.foil ? " (Foil)" : ""}</p>
              {c.priceUsd !== null && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: accentColor }}>${(c.priceUsd * c.quantity).toFixed(2)}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onQuantity(i, Math.max(1, c.quantity - 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10 text-sm font-bold"
              >−</button>
              <span className="text-sm text-text-primary w-5 text-center font-semibold tabular-nums">{c.quantity}</span>
              <button
                onClick={() => onQuantity(i, c.quantity + 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary bg-white/5 hover:bg-white/10 text-sm font-bold"
              >+</button>
              <button
                onClick={() => onRemove(i)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 ml-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-accent/40 text-text-muted hover:text-accent transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-sm font-medium">Add Card</span>
      </button>
    </div>
  );
}

function TradeDetail({ trade, onUpdate, onBack, onDelete }: {
  trade: Trade;
  onUpdate: (id: string, changes: Partial<Omit<Trade, "id">>) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
}) {
  const [offering, setOffering] = useState<TradeCard[]>(trade.offering);
  const [receiving, setReceiving] = useState<TradeCard[]>(trade.receiving);
  const [searchSide, setSearchSide] = useState<"offering" | "receiving" | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(trade.name);
  const nameRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => { if (editingName) nameRef.current?.focus(); }, [editingName]);

  const save = useCallback((o: TradeCard[], r: TradeCard[]) => {
    const offeringTotal = sumTotal(o);
    const receivingTotal = sumTotal(r);
    onUpdate(trade.id, { offering: o, receiving: r, offeringTotal, receivingTotal });
  }, [trade.id, onUpdate]);

  function addCard(side: "offering" | "receiving", card: TradeCard) {
    if (side === "offering") {
      const next = [...offering, card];
      setOffering(next);
      save(next, receiving);
    } else {
      const next = [...receiving, card];
      setReceiving(next);
      save(offering, next);
    }
    setSearchSide(null);
  }

  function removeCard(side: "offering" | "receiving", idx: number) {
    if (side === "offering") {
      const next = offering.filter((_, i) => i !== idx);
      setOffering(next);
      save(next, receiving);
    } else {
      const next = receiving.filter((_, i) => i !== idx);
      setReceiving(next);
      save(offering, next);
    }
  }

  function updateQty(side: "offering" | "receiving", idx: number, qty: number) {
    if (side === "offering") {
      const next = offering.map((c, i) => i === idx ? { ...c, quantity: qty } : c);
      setOffering(next);
      save(next, receiving);
    } else {
      const next = receiving.map((c, i) => i === idx ? { ...c, quantity: qty } : c);
      setReceiving(next);
      save(offering, next);
    }
  }

  const oTotal = sumTotal(offering);
  const rTotal = sumTotal(receiving);
  const diff = rTotal - oTotal;

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-2 -ml-2 text-text-muted hover:text-text-primary">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center flex-1">
          <h1 className="text-sm font-bold text-text-primary">Trading</h1>
          {editingName ? (
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { setEditingName(false); if (name.trim()) onUpdate(trade.id, { name: name.trim() }); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setEditingName(false); if (name.trim()) onUpdate(trade.id, { name: name.trim() }); } }}
              className="text-xs text-accent bg-transparent text-center outline-none border-b border-accent/40 w-40"
            />
          ) : (
            <button onClick={() => setEditingName(true)} className="text-xs text-accent hover:underline">{trade.name}</button>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 -mr-2 text-text-muted hover:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                <button
                  onClick={() => { setShowMenu(false); onDelete(trade.id); onBack(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete Trade
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trade area — stacked on mobile, side-by-side on sm+ */}
      <div className="flex-1 px-4 pt-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-3">
          <TradeSide
            label="You Give"
            cards={offering}
            onAdd={() => setSearchSide("offering")}
            onRemove={(i) => removeCard("offering", i)}
            onQuantity={(i, q) => updateQty("offering", i, q)}
            total={oTotal}
            accentColor="#EF4444"
          />
          <div className="hidden sm:block w-px bg-border/60 self-stretch flex-shrink-0" />
          <div className="sm:hidden h-px bg-border/60 flex-shrink-0" />
          <TradeSide
            label="You Get"
            cards={receiving}
            onAdd={() => setSearchSide("receiving")}
            onRemove={(i) => removeCard("receiving", i)}
            onQuantity={(i, q) => updateQty("receiving", i, q)}
            total={rTotal}
            accentColor="#22C55E"
          />
        </div>
      </div>

      {/* Bottom value bar */}
      <div className="sticky bottom-16 mx-4 mb-2">
        <div className="glass-card border border-border rounded-2xl px-5 py-3 flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xs text-text-muted">Giving</p>
            <p className="text-sm font-bold text-red-400">${oTotal.toFixed(2)}</p>
          </div>
          <div className="text-center px-4">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🇺🇸</span>
              <span className="text-xs font-bold text-text-primary">USD</span>
            </div>
            <p className={`text-xs font-bold mt-0.5 ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-text-muted"}`}>
              {diff >= 0 ? "+" : ""}{diff.toFixed(2)}
            </p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-text-muted">Getting</p>
            <p className="text-sm font-bold text-emerald-400">${rTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {searchSide && (
        <CardSearchModal
          onClose={() => setSearchSide(null)}
          onAdd={(card) => addCard(searchSide, card)}
        />
      )}
    </div>
  );
}

export default function TradesPage() {
  const router = useRouter();
  const { trades, loading, addTrade, updateTrade, deleteTrade } = useTrades();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTrade = trades.find((t) => t.id === selectedId);

  async function handleNewTrade() {
    const trade = await addTrade({
      name: `Trade ${trades.length + 1}`,
      date: new Date().toISOString(),
      offering: [],
      receiving: [],
      offeringTotal: 0,
      receivingTotal: 0,
    });
    if (trade) setSelectedId(trade.id);
  }

  if (selectedTrade) {
    return (
      <TradeDetail
        trade={selectedTrade}
        onUpdate={updateTrade}
        onBack={() => setSelectedId(null)}
        onDelete={deleteTrade}
      />
    );
  }

  const groups = groupByWeek(trades);

  return (
    <div className="flex flex-col min-h-screen pb-20 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-muted hover:text-text-primary">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-text-primary">Trading</h1>
        <div className="w-9" />
      </div>

      {/* Trade List */}
      <div className="flex-1 px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <p className="text-text-primary font-semibold mb-1">No trades yet</p>
            <p className="text-text-muted text-sm">Create your first trade to start tracking card swaps</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-text-primary bg-white/8 px-3 py-1 rounded-full">{group.label}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
                </div>
                <div className="space-y-2">
                  {group.trades.map((trade) => (
                    <button
                      key={trade.id}
                      onClick={() => setSelectedId(trade.id)}
                      className="w-full text-left glass-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-semibold text-text-primary">{trade.name}</p>
                        <p className="text-xs text-text-muted">{formatDate(trade.date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-muted mb-0.5">Giving</p>
                          {trade.offering.length > 0 ? (
                            <div className="flex -space-x-2">
                              {trade.offering.slice(0, 4).map((c, i) => (
                                c.imageUri ? (
                                  <img key={i} src={c.imageUri} alt="" className="w-7 h-10 rounded object-cover border border-bg-primary" />
                                ) : (
                                  <div key={i} className="w-7 h-10 rounded bg-white/10 border border-bg-primary" />
                                )
                              ))}
                              {trade.offering.length > 4 && (
                                <div className="w-7 h-10 rounded bg-white/10 border border-bg-primary flex items-center justify-center text-[10px] text-text-muted">
                                  +{trade.offering.length - 4}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-text-muted opacity-50">Empty</p>
                          )}
                        </div>
                        <div className="flex flex-col items-center flex-shrink-0 px-2">
                          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-muted mb-0.5">Getting</p>
                          {trade.receiving.length > 0 ? (
                            <div className="flex -space-x-2">
                              {trade.receiving.slice(0, 4).map((c, i) => (
                                c.imageUri ? (
                                  <img key={i} src={c.imageUri} alt="" className="w-7 h-10 rounded object-cover border border-bg-primary" />
                                ) : (
                                  <div key={i} className="w-7 h-10 rounded bg-white/10 border border-bg-primary" />
                                )
                              ))}
                              {trade.receiving.length > 4 && (
                                <div className="w-7 h-10 rounded bg-white/10 border border-bg-primary flex items-center justify-center text-[10px] text-text-muted">
                                  +{trade.receiving.length - 4}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-text-muted opacity-50">Empty</p>
                          )}
                        </div>
                      </div>
                      {(trade.offeringTotal > 0 || trade.receivingTotal > 0) && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                          <span className="text-xs text-red-400 font-semibold">${trade.offeringTotal.toFixed(2)}</span>
                          <span className="text-[10px] text-text-muted">vs</span>
                          <span className="text-xs text-emerald-400 font-semibold">${trade.receivingTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Trade FAB */}
      <div className="sticky bottom-20 flex justify-center px-4 pb-2">
        <button
          onClick={handleNewTrade}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl btn-gradient font-bold text-sm shadow-lg shadow-accent/20 active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Trade
        </button>
      </div>
    </div>
  );
}
