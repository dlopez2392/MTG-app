"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const DeckStatsClient = dynamic(
  () => import("@/components/decks/DeckStatsClient"),
  { ssr: false }
);

export default function DeckStatsPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  return <DeckStatsClient deckId={deckId} />;
}
