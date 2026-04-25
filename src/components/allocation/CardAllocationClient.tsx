"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface DeckRef {
  deckId: string;
  deckName: string;
  quantity: number;
}

interface BinderRef {
  binderId: string;
  binderName: string;
  quantity: number;
}

interface AllocationEntry {
  scryfallId: string;
  name: string;
  imageUri: string | null;
  ownedQty: number;
  totalNeeded: number;
  decks: DeckRef[];
  binders: BinderRef[];
  conflict: boolean;
}

interface AllocationData {
  allocations: AllocationEntry[];
  totalShared: number;
  totalConflicts: number;
}

type FilterMode = "all" | "conflicts" | "shared";

export default function CardAllocationClient() {
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/card-allocation")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data || data.allocations.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))" }}
        >
          <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-white/60 font-medium">No shared or conflicting cards</p>
        <p className="text-xs text-white/30 mt-1">All your deck cards are uniquely allocated</p>
      </div>
    );
  }

  const filtered = data.allocations.filter((a) => {
    if (filter === "conflicts" && !a.conflict) return false;
    if (filter === "shared" && a.decks.length < 2) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-[1px] overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(245,158,11,0.1))" }}
        >
          <div
            className="rounded-2xl px-4 py-4 text-center"
            style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85), rgba(30,30,45,0.9))" }}
          >
            <p className="text-2xl font-bold text-amber-400">{data.totalShared}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Shared Cards</p>
          </div>
        </div>
        <div
          className="rounded-2xl p-[1px] overflow-hidden"
          style={{ background: data.totalConflicts > 0
            ? "linear-gradient(135deg, rgba(239,68,68,0.4), rgba(239,68,68,0.1))"
            : "linear-gradient(135deg, rgba(34,197,94,0.4), rgba(34,197,94,0.1))"
          }}
        >
          <div
            className="rounded-2xl px-4 py-4 text-center"
            style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.85), rgba(30,30,45,0.9))" }}
          >
            <p className={cn("text-2xl font-bold", data.totalConflicts > 0 ? "text-red-400" : "text-green-400")}>
              {data.totalConflicts}
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Conflicts</p>
          </div>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {(["all", "conflicts", "shared"] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-accent/20 text-accent"
                  : "text-white/40 hover:text-white/60"
              )}
              style={filter === f ? { boxShadow: "inset 0 0 12px rgba(124,92,252,0.1)" } : undefined}
            >
              {f === "all" ? `All (${data.allocations.length})` : f === "conflicts" ? `Conflicts (${data.totalConflicts})` : `Shared (${data.totalShared})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          className="w-full rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
      </div>

      {/* Allocation list */}
      <div className="flex flex-col gap-3">
        {filtered.map((entry) => (
          <div
            key={entry.scryfallId}
            className="rounded-xl p-[1px] overflow-hidden"
            style={{
              background: entry.conflict
                ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.05))"
                : "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
            }}
          >
            <div
              className="rounded-xl p-4"
              style={{
                background: "linear-gradient(135deg, rgba(20,20,30,0.9), rgba(15,15,25,0.95))",
                boxShadow: entry.conflict ? "inset 0 0 20px rgba(239,68,68,0.05)" : undefined,
              }}
            >
              <div className="flex items-start gap-3">
                {entry.imageUri && (
                  <img
                    src={entry.imageUri}
                    alt=""
                    className="w-10 h-14 rounded object-cover flex-shrink-0"
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white/80 truncate">{entry.name}</p>
                    {entry.conflict && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold flex-shrink-0">
                        CONFLICT
                      </span>
                    )}
                  </div>

                  {/* Owned vs needed */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-white/40">
                      Own: <strong className={cn(
                        entry.ownedQty >= entry.totalNeeded ? "text-green-400" : "text-red-400"
                      )}>{entry.ownedQty}</strong>
                    </span>
                    <span className="text-xs text-white/40">
                      Need: <strong className="text-white/60">{entry.totalNeeded}</strong>
                    </span>
                    {entry.decks.length >= 2 && (
                      <span className="text-xs text-amber-400/60">
                        In {entry.decks.length} decks
                      </span>
                    )}
                  </div>

                  {/* Deck list */}
                  <div className="flex flex-wrap gap-1.5">
                    {entry.decks.map((d) => (
                      <span
                        key={d.deckId}
                        className="text-[11px] px-2 py-1 rounded-md font-medium"
                        style={{
                          background: "rgba(124,92,252,0.1)",
                          color: "rgba(167,139,250,0.8)",
                        }}
                      >
                        {d.deckName} ×{d.quantity}
                      </span>
                    ))}
                  </div>

                  {/* Binder locations */}
                  {entry.binders.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {entry.binders.map((b) => (
                        <span
                          key={b.binderId}
                          className="text-[11px] px-2 py-1 rounded-md font-medium"
                          style={{
                            background: "rgba(34,197,94,0.1)",
                            color: "rgba(34,197,94,0.7)",
                          }}
                        >
                          📁 {b.binderName} ×{b.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-white/30 py-6">No cards match your filter</p>
        )}
      </div>
    </div>
  );
}
