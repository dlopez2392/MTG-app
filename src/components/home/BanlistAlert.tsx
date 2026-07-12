"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { askAndSubscribe, pushSupported, pushPermission } from "@/lib/push/subscribe";

interface Notification {
  eventId: string;
  cardName: string;
  format: string;
  status: "banned" | "restricted" | "unbanned" | "review";
  sourceUrl: string;
  sourceTitle: string;
  announcedAt: string;
  seen: boolean;
  decks: { id: string; name: string }[];
}

function headline(n: Notification): string {
  const fmt = n.format && n.format !== "Unknown" && n.format !== "your" ? n.format : "";
  if (n.status === "review") {
    return `B&R update — review your ${fmt || "affected"} decks`;
  }
  const verb =
    n.status === "banned" ? "banned" : n.status === "restricted" ? "restricted" : "unbanned";
  return `${n.cardName} ${verb}${fmt ? ` in ${fmt}` : ""}`;
}

export default function BanlistAlert() {
  const { isSignedIn, isLoaded } = useUser();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showOptIn, setShowOptIn] = useState(false);
  const [optInState, setOptInState] = useState<"idle" | "busy" | "done" | "denied">("idle");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetch("/api/banlist/scan")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setNotifs(data.notifications ?? []);
      })
      .catch(() => {
        /* silent — alert simply doesn't render */
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const unseen = notifs.filter((n) => !n.seen && !dismissed.has(n.eventId));
  if (unseen.length === 0) {
    // If the user just cleared alerts and can enable push in-context, offer it once.
    if (showOptIn && optInState !== "done") {
      return <OptIn state={optInState} onEnable={handleEnable} />;
    }
    return null;
  }

  function handleDismiss(eventId: string) {
    setDismissed((prev) => new Set(prev).add(eventId));
    fetch("/api/banlist/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    }).catch(() => {});
    // After dismissing, surface push opt-in in-context (never on load) if eligible.
    if (pushSupported() && pushPermission() === "default") setShowOptIn(true);
  }

  async function handleEnable() {
    setOptInState("busy");
    const ok = await askAndSubscribe();
    setOptInState(ok ? "done" : "denied");
  }

  const top = unseen[0];
  const tone =
    top.status === "banned"
      ? "border-banned/40"
      : top.status === "restricted"
        ? "border-accent/40"
        : "border-border";

  return (
    <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
      <div className={`glass-card border ${tone} rounded-xl p-3 flex items-start gap-3`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{headline(top)}</p>
          {top.decks.length > 0 && (
            <p className="text-xs text-text-secondary mt-0.5">
              {top.decks.length} deck{top.decks.length !== 1 ? "s" : ""} affected
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {top.decks.slice(0, 4).map((d) => (
              <Link
                key={d.id}
                href={`/decks/${d.id}`}
                className="text-xs font-medium text-accent hover:underline truncate max-w-[9rem]"
              >
                {d.name}
              </Link>
            ))}
            <a
              href={top.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Announcement ↗
            </a>
          </div>
          {unseen.length > 1 && (
            <p className="text-[10px] text-text-muted mt-1.5">
              +{unseen.length - 1} more update{unseen.length - 1 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => handleDismiss(top.eventId)}
          aria-label="Dismiss"
          className="p-1 -m-1 text-text-muted hover:text-text-primary shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function OptIn({ state, onEnable }: { state: "idle" | "busy" | "done" | "denied"; onEnable: () => void }) {
  if (state === "done") return null;
  return (
    <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
      <div className="glass-card border border-border rounded-xl p-3 flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {state === "denied"
            ? "Notifications are blocked — enable them in your browser settings to get ban alerts."
            : "Get notified when a card in your decks gets banned?"}
        </p>
        {state !== "denied" && (
          <button
            onClick={onEnable}
            disabled={state === "busy"}
            className="shrink-0 px-3 py-1.5 rounded-lg btn-gradient text-xs font-bold disabled:opacity-50"
          >
            {state === "busy" ? "…" : "Notify me"}
          </button>
        )}
      </div>
    </div>
  );
}
