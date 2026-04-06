"use client";

import dynamic from "next/dynamic";

const CollectionPageClient = dynamic(
  () => import("@/components/collection/CollectionPageClient"),
  { ssr: false }
);

export default function CollectionPage() {
  return <CollectionPageClient />;
}
