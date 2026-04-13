"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NewsItemRow from "./NewsItem";
import type { NewsItem } from "@/lib/news/rss";

const STORAGE_KEY = "mtg_news_enabled_feeds";

function getEnabledFeeds(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export default function NewsWidget() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const feeds = getEnabledFeeds();
      const url = feeds ? `/api/news?feeds=${encodeURIComponent(feeds)}` : "/api/news";
      const res = await fetch(url);
      const data = await res.json();
      setItems((data.items ?? []).slice(0, 3));
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 pb-4 max-w-2xl mx-auto w-full">
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Link
              href="/news"
              className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors"
              title="Open news"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </Link>
            <h2 className="text-section-label text-text-primary tracking-widest">News</h2>
          </div>
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="p-1 text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="px-4 divide-y divide-border/50">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-3">
                <div className="w-16 h-16 rounded-lg skeleton-shimmer shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 skeleton-shimmer rounded w-full" />
                  <div className="h-3.5 skeleton-shimmer rounded w-3/4" />
                  <div className="h-3 skeleton-shimmer rounded w-1/3 mt-2" />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No news available</p>
          ) : (
            items.map((item) => (
              <NewsItemRow key={item.id} item={item} compact />
            ))
          )}
        </div>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <Link
            href="/news"
            className="flex items-center justify-center gap-1.5 py-3 border-t border-border/50 text-xs font-semibold text-accent hover:text-accent-light transition-colors"
          >
            View all news
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
