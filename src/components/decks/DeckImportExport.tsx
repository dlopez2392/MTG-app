"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import { parseDeckList, exportDeckList } from "@/lib/utils/deckParser";
import type { DeckCard } from "@/types/deck";

interface DeckImportExportProps {
  open: boolean;
  onClose: () => void;
  deckId: string;
  cards: DeckCard[];
}

const TABS = [
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
];

export default function DeckImportExport({ open, onClose, deckId, cards }: DeckImportExportProps) {
  const [mode, setMode] = useState("import");
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);

  const exportText = exportDeckList(
    cards.map((c) => ({ name: c.name, quantity: c.quantity, category: c.category }))
  );

  function handleImport() {
    const entries = parseDeckList(importText);
    if (entries.length === 0) return;
    // Navigate to search to resolve card names (full import requires Scryfall lookups)
    // For now, we store the parsed list in sessionStorage for the search page to pick up
    sessionStorage.setItem(
      `deck-import-${deckId}`,
      JSON.stringify(entries)
    );
    setImportText("");
    onClose();
    window.location.href = `/search?deckId=${deckId}&importing=true`;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={open} onClose={onClose} title="Import / Export">
      <Tabs tabs={TABS} active={mode} onChange={setMode} className="mb-4" />

      {mode === "import" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Paste a deck list below. Supports formats like &quot;4 Lightning Bolt&quot; with optional section headers (Sideboard, Commander).
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"4 Lightning Bolt\n4 Monastery Swiftspear\n20 Mountain\n\nSideboard\n2 Roiling Vortex"}
            className="w-full h-48 bg-bg-card border border-border rounded-lg p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none font-mono"
          />
          <Button onClick={handleImport} disabled={!importText.trim()}>
            Import Deck List
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Copy this deck list to share or use in other apps.
          </p>
          <textarea
            readOnly
            value={exportText}
            className="w-full h-48 bg-bg-card border border-border rounded-lg p-3 text-sm text-text-primary resize-none font-mono"
          />
          <Button onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
