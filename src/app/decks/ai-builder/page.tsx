"use client";

import dynamic from "next/dynamic";

const AIDeckBuilderClient = dynamic(
  () => import("@/components/decks/AIDeckBuilderClient"),
  { ssr: false }
);

export default function AIDeckBuilderPage() {
  return <AIDeckBuilderClient />;
}
