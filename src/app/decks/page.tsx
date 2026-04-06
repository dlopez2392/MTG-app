"use client";

import dynamic from "next/dynamic";

const DecksPageClient = dynamic(
  () => import("@/components/decks/DecksPageClient"),
  { ssr: false }
);

export default function DecksPage() {
  return <DecksPageClient />;
}
