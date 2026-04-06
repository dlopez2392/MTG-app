"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const DeckEditorPageClient = dynamic(
  () => import("@/components/decks/DeckEditorPageClient"),
  { ssr: false }
);

export default function DeckEditorPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  return <DeckEditorPageClient deckId={deckId} />;
}
