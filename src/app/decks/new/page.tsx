"use client";

import { lazy, Suspense } from "react";

const NewDeckClient = lazy(() => import("@/components/decks/NewDeckClient"));

export default function NewDeckPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <NewDeckClient />
    </Suspense>
  );
}
