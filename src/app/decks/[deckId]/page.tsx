"use client";

import { lazy, Suspense, use } from "react";

const DeckEditorPageClient = lazy(
  () => import("@/components/decks/DeckEditorPageClient")
);

export default function DeckEditorPage({
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
      <DeckEditorPageClient deckId={deckId} />
    </Suspense>
  );
}
