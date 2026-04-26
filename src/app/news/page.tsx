"use client";

import { useState, useEffect, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import NewsItemRow from "@/components/news/NewsItem";
import { FEEDS, DEFAULT_ENABLED } from "@/lib/news/feeds";
import type { NewsItem } from "@/lib/news/rss";
import { cn } from "@/lib/utils/cn";
import Checkbox from "@/components/ui/Checkbox";

const STORAGE_KEY = "mtg_news_enabled_feeds";

function loadEnabled(): Set<string> {
  if (typeof window === "undefined") return DEFAULT_ENABLED;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_ENABLED;
  return new Set(saved.split(",").filter(Boolean));
}

function saveEnabled(keys: Set<string>) {
  localStorage.setItem(STORAGE_KEY, [...keys].join(","));
}

export default function NewsPage() {
  const [enabled, setEnabled] = useState<Set<string>>(DEFAULT_ENABLED);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load persisted feed prefs on mount
  useEffect(() => {
    setEnabled(loadEnabled());
  }, []);

  const fetchNews = useCallback(async (enabledFeeds: Set<string>) => {
    setLoading(true);
    setItems([]);
    try {
      const feedsParam = [...enabledFeeds].join(",");
      const res = await fetch(`/api/news?feeds=${encodeURIComponent(feedsParam)}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(enabled);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function toggleFeed(key: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      saveEnabled(next);
      return next;
    });
  }

  function applyFilter() {
    setShowFilter(false);
    setRefreshKey((k) => k + 1);
    fetchNews(enabled);
  }

  return (
    <>
      <TopBar
        title="News"
        showBack
        rightContent={
          <button
            onClick={() => setShowFilter(true)}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors"
            title="Filter feeds"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
            </svg>
          </button>
        }
      />

      <PageContainer>
        {/* Refresh button row */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-caption">
            {loading ? "Loading…" : `${items.length} articles`}
          </p>
          <button
            onClick={() => { setRefreshKey((k) => k + 1); fetchNews(enabled); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors disabled:opacity-40"
          >
            <svg className={cn("w-3.5 h-3.5", loading && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-3">
                <div className="w-20 h-20 rounded-lg skeleton-shimmer shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 skeleton-shimmer rounded w-full" />
                  <div className="h-4 skeleton-shimmer rounded w-5/6" />
                  <div className="h-3 skeleton-shimmer rounded w-2/3 mt-1" />
                  <div className="h-3 skeleton-shimmer rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Articles */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-text-muted">
            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
            <p className="text-sm">No articles found. Try enabling more feeds.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <NewsItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </PageContainer>

      {/* ── Feed filter sheet ── */}
      {showFilter && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[90]" onClick={() => setShowFilter(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[91] bg-bg-secondary border-t border-border rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="text-base font-bold text-text-primary">Enabled feeds</h2>
              <button onClick={() => setShowFilter(false)} className="text-text-muted hover:text-text-primary transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-2 divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
              {FEEDS.map((feed) => {
                const on = enabled.has(feed.key);
                return (
                  <button
                    key={feed.key}
                    onClick={() => toggleFeed(feed.key)}
                    className="w-full flex items-center gap-4 py-3.5 text-left"
                  >
                    {/* Color avatar */}
                    <div
                      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: feed.color }}
                    >
                      {feed.initials.slice(0, 2)}
                    </div>
                    <span className="flex-1 text-sm font-medium text-text-primary">{feed.name}</span>
                    <Checkbox checked={on} onChange={() => toggleFeed(feed.key)} />
                  </button>
                );
              })}
            </div>

            <div className="px-5 pt-3 pb-4">
              <button
                onClick={applyFilter}
                className="w-full py-3 rounded-xl btn-gradient font-bold text-sm active:scale-[0.98] transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
