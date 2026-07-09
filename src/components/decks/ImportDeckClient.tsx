"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import { useDecks } from "@/hooks/useDecks";
import { parseDeckUrl } from "@/lib/utils/deckUrl";
import { parseDeckList } from "@/lib/utils/deckParser";
import type { DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

const TABS = [
  { value: "link", label: "From Link" },
  { value: "text", label: "Paste Text" },
];

interface ResolvedEntry {
  quantity: number;
  category: DeckCategory;
  card: Partial<ScryfallCard> & { id: string; name: string };
}

interface ImportOutcome {
  deckId: string;
  name: string;
  imported: number;
  skipped: string[];
}

export default function ImportDeckClient() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { createDeck, updateDeck, addCardToDeck } = useDecks();

  const [tab, setTab] = useState("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  const urlValid = parseDeckUrl(url) !== null;

  // Save an already-resolved card list as a new local/remote deck via useDecks.
  async function saveResolvedDeck(
    name: string,
    format: string | undefined,
    entries: ResolvedEntry[],
    skipped: string[]
  ) {
    setStatus(`Creating "${name}"…`);
    const deckId = await createDeck(name, format);
    const cover = entries.find(
      (e) => e.card.image_uris?.normal || e.card.card_faces?.[0]?.image_uris?.normal
    );
    if (cover) {
      await updateDeck(deckId, {
        coverCardId: cover.card.id,
        coverImageUri:
          cover.card.image_uris?.normal ?? cover.card.card_faces?.[0]?.image_uris?.normal,
      });
    }
    let done = 0;
    for (const e of entries) {
      await addCardToDeck(deckId, e.card, e.category, e.quantity);
      done++;
      if (done % 20 === 0) setStatus(`Adding cards… ${done}/${entries.length}`);
    }
    setOutcome({ deckId, name, imported: entries.length, skipped });
  }

  async function handleLinkImport() {
    setBusy(true);
    setError(null);
    setStatus("Fetching deck…");
    try {
      if (isSignedIn) {
        // Server persists directly to Supabase
        const res = await fetch("/api/import-deck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, persist: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setOutcome({
          deckId: data.deckId,
          name: data.name,
          imported: data.importedCards,
          skipped: data.skipped ?? [],
        });
      } else {
        // Guest: resolve server-side, save locally
        const res = await fetch("/api/import-deck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, persist: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        await saveResolvedDeck(data.name, data.format, data.cards, data.skipped ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function handleTextImport() {
    const entries = parseDeckList(text);
    if (entries.length === 0) {
      setError("Nothing to import — paste a deck list first.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Looking up cards…");
    try {
      // Resolve names via Scryfall collection endpoint (75/batch, 120ms apart)
      const CHUNK = 75;
      const resolved: ResolvedEntry[] = [];
      const skipped: string[] = [];
      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        const res = await fetch("https://api.scryfall.com/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: chunk.map((e) => ({ name: e.name })) }),
        });
        if (!res.ok) {
          skipped.push(...chunk.map((e) => e.name));
          continue;
        }
        const data = await res.json();
        const found = new Map<string, ScryfallCard>(
          (data.data ?? []).map((c: ScryfallCard) => [c.name.toLowerCase(), c])
        );
        for (const entry of chunk) {
          // Scryfall returns full "Front // Back" names; match either exact or front-face
          const card =
            found.get(entry.name.toLowerCase()) ??
            [...found.values()].find((c) =>
              c.name.toLowerCase().startsWith(entry.name.toLowerCase() + " //")
            );
          if (card) {
            resolved.push({ quantity: entry.quantity, category: entry.category, card });
          } else {
            skipped.push(entry.name);
          }
        }
        if (i + CHUNK < entries.length) await new Promise((r) => setTimeout(r, 120));
      }
      if (resolved.length === 0) {
        setError("No cards could be found. Check the list format and spelling.");
        return;
      }
      const deckName = `Imported Deck ${new Date().toLocaleDateString()}`;
      await saveResolvedDeck(deckName, undefined, resolved, skipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <>
      <TopBar title="Import Deck" showBack />
      <PageContainer>
        <div className="max-w-lg mx-auto w-full flex flex-col gap-4">
          {!outcome && (
            <>
              <Tabs tabs={TABS} active={tab} onChange={(v) => { setTab(v); setError(null); }} />

              {tab === "link" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-secondary">
                    Paste a Moxfield or Archidekt deck link.
                  </p>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://moxfield.com/decks/…"
                    autoFocus
                  />
                  {url.trim() && !urlValid && (
                    <p className="text-xs text-banned">
                      That doesn&apos;t look like a Moxfield or Archidekt deck link.
                    </p>
                  )}
                  <Button onClick={handleLinkImport} disabled={!urlValid || busy || !isLoaded}>
                    {busy ? status || "Importing…" : "Import Deck"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-secondary">
                    Paste any deck list — plain text or MTG Arena export. Section headers
                    (Deck, Sideboard, Commander, Companion) are recognized.
                  </p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={"4 Lightning Bolt (M21) 123\n20 Mountain\n\nSideboard\n2 Roiling Vortex"}
                    className="w-full h-56 input-base p-3 resize-none font-mono text-sm"
                  />
                  <Button onClick={handleTextImport} disabled={!text.trim() || busy || !isLoaded}>
                    {busy ? status || "Importing…" : "Import Deck"}
                  </Button>
                </div>
              )}

              {error && (
                <div className="bg-banned/10 border border-banned/20 rounded-xl p-3">
                  <p className="text-sm text-banned">{error}</p>
                </div>
              )}
            </>
          )}

          {outcome && (
            <div className="flex flex-col gap-4 animate-scale-in">
              <div className="bg-legal/10 border border-legal/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-legal">
                  Imported &quot;{outcome.name}&quot; — {outcome.imported} card
                  {outcome.imported !== 1 ? "s" : ""}
                </p>
              </div>

              {outcome.skipped.length > 0 && (
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-banned mb-2">
                    Couldn&apos;t find {outcome.skipped.length} card
                    {outcome.skipped.length !== 1 ? "s" : ""} — add them manually in the deck
                    editor:
                  </p>
                  <ul className="text-xs text-text-secondary space-y-1 max-h-40 overflow-y-auto">
                    {outcome.skipped.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={() => router.push(`/decks/${outcome.deckId}`)}>
                Open Deck
              </Button>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
