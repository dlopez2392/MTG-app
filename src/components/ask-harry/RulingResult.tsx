"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface RulingResultProps {
  ruling: string;
  confidence: "high" | "medium" | "low" | null;
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
  streaming?: boolean;
}

const CONFIDENCE_STYLES = {
  high: { bg: "bg-green-500/15", text: "text-green-400", dot: "bg-green-400", label: "High Confidence" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400", label: "Medium Confidence" },
  low: { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400", label: "Low Confidence" },
};

export default function RulingResult({ ruling, confidence, citedRules, cardsAnalyzed, model, streaming = false }: RulingResultProps) {
  const [showRules, setShowRules] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const conf = confidence ? CONFIDENCE_STYLES[confidence] : null;
  const modelLabel = model === "pro" ? "DeepSeek Pro" : "DeepSeek Flash";

  // Load existing feedback
  useEffect(() => {
    try {
      const stored = localStorage.getItem("harry-feedback");
      if (stored) {
        const data = JSON.parse(stored);
        const key = ruling.slice(0, 80);
        if (data[key]) setFeedback(data[key]);
      }
    } catch { /* ignore */ }
  }, [ruling]);

  function handleFeedback(type: "up" | "down") {
    const next = feedback === type ? null : type;
    setFeedback(next);
    try {
      const stored = localStorage.getItem("harry-feedback");
      const data = stored ? JSON.parse(stored) : {};
      const key = ruling.slice(0, 80);
      if (next) {
        data[key] = next;
      } else {
        delete data[key];
      }
      localStorage.setItem("harry-feedback", JSON.stringify(data));
    } catch { /* ignore */ }
  }

  return (
    <div className="glass-card rounded-2xl border border-border p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        {conf ? (
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", conf.bg, conf.text)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", conf.dot)} />
            {conf.label}
          </span>
        ) : streaming ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-hover text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Analyzing…
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] text-text-muted font-medium px-2 py-0.5 rounded-md bg-bg-hover">
          {modelLabel}
        </span>
      </div>

      {/* Ruling text */}
      <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {ruling}
        {streaming && <span className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 bg-accent/70 animate-pulse align-middle" />}
      </div>

      {/* Cited Rules expandable */}
      {citedRules.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRules(!showRules)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg
              className={cn("w-3.5 h-3.5 transition-transform", showRules && "rotate-90")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Cited Rules ({citedRules.length})
          </button>
          {showRules && (
            <div className="mt-2 space-y-2 pl-5">
              {citedRules.map((rule) => (
                <div key={rule.number} className="text-xs">
                  <span className="font-mono text-accent font-medium">{rule.number}</span>
                  <span className="text-text-muted ml-2">{rule.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cards Analyzed expandable */}
      {cardsAnalyzed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCards(!showCards)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg
              className={cn("w-3.5 h-3.5 transition-transform", showCards && "rotate-90")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Cards Analyzed ({cardsAnalyzed.length})
          </button>
          {showCards && (
            <div className="mt-2 space-y-2 pl-5">
              {cardsAnalyzed.map((card) => (
                <div key={card.name} className="text-xs">
                  <span className="font-semibold text-text-primary">{card.name}</span>
                  <p className="text-text-muted mt-0.5 italic">{card.oracleText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <span className="text-[10px] text-text-muted mr-1">Was this helpful?</span>
        <button
          type="button"
          onClick={() => handleFeedback("up")}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            feedback === "up" ? "bg-green-500/20 text-green-400" : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleFeedback("down")}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            feedback === "down" ? "bg-red-500/20 text-red-400" : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-1.302 4.665c-.245.404.028.96.5.96h1.053c.832 0 1.612-.453 1.918-1.227.306-.774.51-1.6.637-2.452a.75.75 0 00-.159-.596A11.924 11.924 0 0018.75 6.75c0-.211.005-.422.015-.631a.75.75 0 00-.358-.674A4.46 4.46 0 0016.5 5.25a4.46 4.46 0 00-1.907.425.75.75 0 00-.358.674c.01.209.015.42.015.631 0 .656-.066 1.296-.191 1.913a.75.75 0 01-.574.574 13.07 13.07 0 01-3.485.467V5.25A2.25 2.25 0 007.75 3H6.5a.75.75 0 00-.75.75v7.5c0 .414.336.75.75.75h1.25a2.25 2.25 0 002.25-2.25V9.75m0 5.25h2.25" />
          </svg>
        </button>
      </div>
    </div>
  );
}
