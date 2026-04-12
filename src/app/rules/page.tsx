import type { Metadata } from "next";
import RulesPageClient from "@/components/rules/RulesPageClient";

export const metadata: Metadata = {
  title: "Comprehensive Rules — MTG Houdini",
  description: "Magic: The Gathering Comprehensive Rules — fully searchable with table of contents.",
};

export default function RulesPage() {
  return <RulesPageClient />;
}
