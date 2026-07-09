"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  hasGuestData,
  guestDataSummary,
  collectGuestData,
  clearGuestData,
  isMergeDismissed,
  dismissMerge,
} from "@/lib/utils/guestData";

type Phase = "offer" | "merging" | "done" | "error";

export default function MergeGuestPrompt() {
  const { isSignedIn, isLoaded } = useUser();
  const [dismissedNow, setDismissedNow] = useState(false);
  const [phase, setPhase] = useState<Phase>("offer");
  const [result, setResult] = useState<{ decks: number; binders: number; cards: number; errors: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Render-time gate — no effects (repo lint forbids setState-in-effect).
  const eligible =
    isLoaded && isSignedIn === true && !dismissedNow && !isMergeDismissed() && hasGuestData();

  if (!eligible && phase === "offer") return null;

  const summary = guestDataSummary();

  async function handleMerge() {
    setPhase("merging");
    try {
      const res = await fetch("/api/merge-guest-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectGuestData()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");
      setResult(data);
      if ((data.errors ?? []).length === 0) {
        clearGuestData();
      }
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Merge failed");
      setPhase("error");
    }
  }

  function handleClose() {
    if (phase === "merging") return;
    // Reload after a successful merge so all data hooks refetch from the account.
    if (phase === "done") {
      window.location.reload();
      return;
    }
    setDismissedNow(true);
    setPhase("offer");
  }

  return (
    <Modal open onClose={handleClose} title="Bring your data with you">
      {phase === "offer" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            This device has {summary.decks} deck{summary.decks !== 1 ? "s" : ""}
            {summary.binders > 0 && <> and {summary.binders} binder{summary.binders !== 1 ? "s" : ""}</>}
            {" "}({summary.cards} cards) saved from before you signed in. Copy them into your
            account so they sync everywhere?
          </p>
          <Button onClick={handleMerge}>Bring my data</Button>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setDismissedNow(true)}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Not now
            </button>
            <button
              onClick={() => { dismissMerge(); setDismissedNow(true); }}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Don&apos;t ask again
            </button>
          </div>
        </div>
      )}

      {phase === "merging" && (
        <p className="text-sm text-text-secondary py-4 text-center">Copying your data…</p>
      )}

      {phase === "done" && result && (
        <div className="flex flex-col gap-4">
          <div className="bg-legal/10 border border-legal/20 rounded-xl p-3">
            <p className="text-sm text-legal">
              Copied {result.decks} deck{result.decks !== 1 ? "s" : ""}, {result.binders} binder
              {result.binders !== 1 ? "s" : ""}, {result.cards} cards to your account.
            </p>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-3">
              <p className="text-xs font-semibold text-banned mb-1">
                Some items couldn&apos;t be copied (your local copies are untouched):
              </p>
              <ul className="text-xs text-text-secondary space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={`${e}-${i}`}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-4">
          <div className="bg-banned/10 border border-banned/20 rounded-xl p-3">
            <p className="text-sm text-banned">{errorMsg}</p>
            <p className="text-xs text-text-secondary mt-1">
              Your local data is untouched. You can try again from this prompt next time.
            </p>
          </div>
          <Button onClick={handleClose}>Close</Button>
        </div>
      )}
    </Modal>
  );
}
