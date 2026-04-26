"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import { parseDeckList, exportDeckList } from "@/lib/utils/deckParser";
import type { DeckCard } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

interface DeckImportExportProps {
  open: boolean;
  onClose: () => void;
  deckId: string;
  cards: DeckCard[];
  onImportCards: (card: Partial<ScryfallCard>, category: DeckCard["category"], quantity: number) => Promise<void>;
}

const TABS = [
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
];

export default function DeckImportExport({
  open,
  onClose,
  deckId,
  cards,
  onImportCards,
}: DeckImportExportProps) {
  const [mode, setMode] = useState("import");
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; notFound: string[] } | null>(null);

  const exportText = exportDeckList(
    cards.map((c) => ({ name: c.name, quantity: c.quantity, category: c.category }))
  );

  async function handleImport() {
    const entries = parseDeckList(importText);
    if (entries.length === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      // Batch fetch from Scryfall in chunks of 75
      const CHUNK = 75;
      const notFound: string[] = [];
      let added = 0;

      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        const res = await fetch("https://api.scryfall.com/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifiers: chunk.map((e) => ({ name: e.name })),
          }),
        });

        if (!res.ok) continue;
        const data = await res.json();

        // Map results back by name
        const found = new Map<string, ScryfallCard>(
          (data.data ?? []).map((c: ScryfallCard) => [c.name.toLowerCase(), c])
        );

        for (const entry of chunk) {
          const card = found.get(entry.name.toLowerCase());
          if (!card) {
            notFound.push(entry.name);
          } else {
            await onImportCards(card, entry.category, entry.quantity);
            added++;
          }
        }

        // Scryfall rate limit: max 10 req/s
        if (i + CHUNK < entries.length) {
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      setImportResult({ added, notFound });
      if (notFound.length === 0) {
        setImportText("");
        setTimeout(onClose, 1200);
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={open} onClose={onClose} title="Import / Export">
      <Tabs tabs={TABS} active={mode} onChange={(v) => { setMode(v); setImportResult(null); }} className="mb-4" />

      {mode === "import" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Paste a deck list below. Supports &quot;4 Lightning Bolt&quot; with optional section headers (Sideboard, Commander, Maybeboard).
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"4 Lightning Bolt\n4 Monastery Swiftspear\n20 Mountain\n\nSideboard\n2 Roiling Vortex"}
            className="w-full h-48 input-base p-3 resize-none font-mono"
          />

          {importResult && (
            <div className={`rounded-lg p-3 text-sm ${importResult.notFound.length > 0 ? "bg-bg-card border border-border" : "bg-legal/10 border border-legal/20"}`}>
              <p className={importResult.notFound.length > 0 ? "text-text-primary" : "text-legal"}>
                {importResult.added} card{importResult.added !== 1 ? "s" : ""} imported successfully.
              </p>
              {importResult.notFound.length > 0 && (
                <div className="mt-2">
                  <p className="text-banned text-xs font-medium mb-1">Not found ({importResult.notFound.length}):</p>
                  <ul className="text-xs text-text-muted space-y-0.5 max-h-24 overflow-y-auto">
                    {importResult.notFound.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleImport} disabled={!importText.trim() || importing}>
            {importing ? "Importing…" : "Import Deck List"}
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
            className="w-full h-48 bg-bg-card border border-border rounded-xl p-3 text-sm text-text-primary resize-none font-mono"
          />
          <Button onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
