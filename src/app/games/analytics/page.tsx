"use client";

import dynamic from "next/dynamic";

const GameAnalyticsClient = dynamic(
  () => import("@/components/games/GameAnalyticsClient"),
  { ssr: false }
);

export default function GameAnalyticsPage() {
  return <GameAnalyticsClient />;
}
