import type { Metadata } from "next";
import ImportDeckClient from "@/components/decks/ImportDeckClient";

export const metadata: Metadata = { title: "Import Deck — MTG Houdini" };

export default function ImportDeckPage() {
  return <ImportDeckClient />;
}
