import dynamic from "next/dynamic";
import type { Metadata } from "next";

const RulesPageClient = dynamic(
  () => import("@/components/rules/RulesPageClient"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Comprehensive Rules — MTG Houdini",
  description: "Magic: The Gathering Comprehensive Rules — fully searchable with table of contents.",
};

export default function RulesPage() {
  return <RulesPageClient />;
}
