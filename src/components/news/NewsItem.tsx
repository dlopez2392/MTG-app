"use client";

import { cn } from "@/lib/utils/cn";
import { FEEDS } from "@/lib/news/feeds";
import type { NewsItem as NewsItemType } from "@/lib/news/rss";

interface Props {
  item: NewsItemType;
  compact?: boolean; // home widget vs full page
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NewsItemRow({ item, compact = false }: Props) {
  const feed = FEEDS.find((f) => f.key === item.feedKey);

  function handleClick() {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex gap-3 text-left active:bg-bg-hover transition-colors py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
    >
      {/* Thumbnail */}
      <div className={cn(
        "shrink-0 rounded-lg overflow-hidden bg-bg-card border border-border/50",
        compact ? "w-16 h-16" : "w-20 h-20"
      )}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-xs font-bold opacity-60"
            style={{ background: feed ? `${feed.color}22` : undefined, color: feed?.color }}
          >
            {feed?.initials ?? "MTG"}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-semibold text-text-primary leading-snug line-clamp-2",
          compact ? "text-sm" : "text-sm"
        )}>
          {item.title}
        </p>
        {!compact && item.description && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {/* Feed color dot */}
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: feed?.color ?? "#888" }}
          />
          {item.author && (
            <span className="text-xs text-text-muted truncate max-w-[100px]">{item.author}</span>
          )}
          {item.author && <span className="text-xs text-text-muted">·</span>}
          <span className="text-xs text-text-muted shrink-0">{timeAgo(item.publishedAt)}</span>
        </div>
      </div>
    </button>
  );
}
