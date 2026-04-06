"use client";

import { lazy, Suspense, use } from "react";

const DeckStatsClient = lazy(
  () => import("@/components/decks/DeckStatsClient")
);

export default function DeckStatsPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DeckStatsClient deckId={deckId} />
    </Suspense>
  );
}
