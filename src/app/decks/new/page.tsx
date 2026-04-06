"use client";

import dynamic from "next/dynamic";

const NewDeckClient = dynamic(
  () => import("@/components/decks/NewDeckClient"),
  { ssr: false }
);

export default function NewDeckPage() {
  return <NewDeckClient />;
}
