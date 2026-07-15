"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import CardChipInput from "@/components/ask-harry/CardChipInput";
import RulingResult from "@/components/ask-harry/RulingResult";
import { useDecks } from "@/hooks/useDecks";
import { splitNdjson } from "@/lib/rules/stream";

interface RulingData {
  ruling: string;
  confidence: "high" | "medium" | "low" | null;
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
}

interface RecentQuestion {
  question: string;
  cards: string[];
  timestamp: number;
}

const HARRY_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

function getRecentQuestions(): RecentQuestion[] {
  try {
    return JSON.parse(localStorage.getItem("harry-recent") ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentQuestion(question: string, cards: string[]) {
  try {
    const recent = getRecentQuestions();
    const entry = { question, cards, timestamp: Date.now() };
    const updated = [entry, ...recent.filter((r) => r.question !== question)].slice(0, 5);
    localStorage.setItem("harry-recent", JSON.stringify(updated));
  } catch { /* localStorage unavailable */ }
}

export default function AskHarryClient() {
  const { isSignedIn } = useUser();
  const { allDecks } = useDecks();
  const [question, setQuestion] = useState("");
  const [cards, setCards] = useState<string[]>([]);
  const [deckId, setDeckId] = useState("");
  const [result, setResult] = useState<RulingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQuestions] = useState<RecentQuestion[]>(() => getRecentQuestions());

  async function handleSubmit() {
    if (!question.trim() || question.trim().length < 3) return;

    setLoading(true);
    setStreaming(true);
    setError(null);
    setResult({ ruling: "", confidence: null, citedRules: [], cardsAnalyzed: [], model: "flash" });

    try {
      const res = await fetch("/api/rules-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          cards: cards.length > 0 ? cards : undefined,
          deckId: deckId || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamError: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const { events, remainder } = splitNdjson(buf);
        buf = remainder;
        for (const ev of events) {
          if (ev.type === "meta") {
            setResult((r) => ({
              ...(r ?? { ruling: "", confidence: null, citedRules: [], cardsAnalyzed: [], model: "flash" }),
              citedRules: (ev.citedRules as RulingData["citedRules"]) ?? [],
              cardsAnalyzed: (ev.cardsAnalyzed as RulingData["cardsAnalyzed"]) ?? [],
              model: (ev.model as "flash" | "pro") ?? "flash",
            }));
          } else if (ev.type === "confidence") {
            setResult((r) => (r ? { ...r, confidence: (ev.value as RulingData["confidence"]) ?? null } : r));
          } else if (ev.type === "token") {
            setResult((r) => (r ? { ...r, ruling: r.ruling + (ev.text as string) } : r));
          } else if (ev.type === "error") {
            streamError = (ev.message as string) ?? "Stream error";
          }
        }
      }
      if (streamError) throw new Error(streamError);
      saveRecentQuestion(question.trim(), cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  function loadRecent(recent: RecentQuestion) {
    setQuestion(recent.question);
    setCards(recent.cards);
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <HeroBanner
        title="Ask Harry"
        subtitle="Your AI rules judge — ask anything about MTG rules and card interactions"
        accent="#7C5CFC"
        icon={HARRY_ICON}
      />

      <PageContainer>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
              Your Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Does Panharmonicon double Solitude's ETB if I evoke it?"
              maxLength={2000}
              rows={3}
              className="w-full input-base px-3 py-2 text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-text-muted tabular-nums">{question.length}/2000</span>
            </div>
          </div>

          <CardChipInput
            cards={cards}
            onAdd={(name) => setCards((prev) => [...prev, name])}
            onRemove={(i) => setCards((prev) => prev.filter((_, j) => j !== i))}
          />

          {isSignedIn && allDecks.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
                Deck context (optional)
              </label>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="w-full input-base px-3 py-2 text-sm"
              >
                <option value="">No deck</option>
                {allDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !question.trim() || question.trim().length < 3 || !isSignedIn}
            className="w-full py-3 rounded-xl btn-gradient text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Harry is thinking...
              </>
            ) : (
              "Ask Harry"
            )}
          </button>

          {!isSignedIn && (
            <p className="text-xs text-text-muted text-center">Sign in to use the AI rules judge</p>
          )}

          {error && (
            <div className="glass-card rounded-xl border border-banned/30 bg-banned/5 p-3">
              <p className="text-sm text-banned">{error}</p>
            </div>
          )}

          {result && (
            <RulingResult
              ruling={result.ruling}
              confidence={result.confidence}
              citedRules={result.citedRules}
              cardsAnalyzed={result.cardsAnalyzed}
              model={result.model}
              streaming={streaming}
            />
          )}

          {!result && recentQuestions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Recent Questions</p>
              <div className="space-y-1.5">
                {recentQuestions.map((rq, i) => (
                  <button
                    key={`${rq.timestamp}-${i}`}
                    type="button"
                    onClick={() => loadRecent(rq)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-border hover:border-accent/30 transition-colors"
                  >
                    <p className="text-sm text-text-primary truncate">{rq.question}</p>
                    {rq.cards.length > 0 && (
                      <p className="text-[10px] text-text-muted mt-0.5">{rq.cards.join(", ")}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
