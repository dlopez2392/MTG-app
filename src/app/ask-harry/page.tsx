"use client";

import dynamic from "next/dynamic";

const AskHarryClient = dynamic(
  () => import("@/components/ask-harry/AskHarryClient"),
  { ssr: false }
);

export default function AskHarryPage() {
  return <AskHarryClient />;
}
