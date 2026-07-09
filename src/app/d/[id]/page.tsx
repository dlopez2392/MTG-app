import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicDeck } from "@/lib/publicDeck";
import { calculateDeckStats } from "@/lib/utils/deckStats";
import ManaCurveChart from "@/components/decks/stats/ManaCurveChart";
import ManaCost from "@/components/cards/ManaCost";
import type { DeckCard } from "@/types/deck";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const deck = await getPublicDeck(id);
  if (!deck) return { title: "Deck not found — MTG Houdini" };
  const count = deck.cards.reduce((s, c) => s + c.quantity, 0);
  return {
    title: `${deck.name} — MTG Houdini`,
    description: `${deck.format ? deck.format.charAt(0).toUpperCase() + deck.format.slice(1) + " deck" : "Deck"} · ${count} cards · shared via MTG Houdini`,
  };
}

const CATEGORY_ORDER = ["commander", "companion", "main", "sideboard", "maybeboard"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  commander: "Commander",
  companion: "Companion",
  main: "Mainboard",
  sideboard: "Sideboard",
  maybeboard: "Maybeboard",
};

export default async function PublicDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getPublicDeck(id);
  if (!deck) notFound();

  // calculateDeckStats expects DeckCard[]; PublicDeckCard is structurally compatible
  // apart from the required deckId field.
  const stats = calculateDeckStats(deck.cards.map((c) => ({ ...c, deckId: id } as DeckCard)));
  const totalCount = deck.cards.reduce((s, c) => s + c.quantity, 0);

  const groups = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      cards: deck.cards
        .filter((c) => c.category === cat)
        .sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.cards.length > 0);

  return (
    <main className="flex-1 w-full max-w-2xl lg:max-w-4xl mx-auto px-4 pb-24 animate-page-enter">
      {/* Hero */}
      <div className="relative -mx-4 mb-4 overflow-hidden">
        {deck.coverImageUri && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deck.coverImageUri}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        <div className="relative z-10 px-4 pt-16 pb-4">
          <p className="text-label text-accent mb-1">Shared deck</p>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-text-primary">
            {deck.name}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {deck.format ? deck.format.charAt(0).toUpperCase() + deck.format.slice(1) : "No format"} · {totalCount} cards
            {stats.totalValue > 0 && <> · ${stats.totalValue.toFixed(2)}</>}
          </p>
        </div>
      </div>

      {/* Mana curve */}
      <div className="glass-card border border-border rounded-2xl p-4 mb-4">
        <p className="text-section-label text-text-muted mb-2">Mana curve</p>
        <ManaCurveChart manaCurve={stats.manaCurve} />
      </div>

      {/* Decklist */}
      {groups.map((group) => (
        <div key={group.cat} className="glass-card border border-border rounded-2xl p-4 mb-4">
          <p className="text-section-label text-text-muted mb-2">
            {group.label} ({group.cards.reduce((s, c) => s + c.quantity, 0)})
          </p>
          <ul className="divide-y divide-border/50">
            {group.cards.map((card) => (
              <li key={`${card.scryfallId}-${card.category}`} className="flex items-center gap-2 py-1.5">
                <span className="text-xs text-text-muted w-6 text-right tabular-nums shrink-0">
                  {card.quantity}×
                </span>
                <span className="text-sm text-text-primary truncate">{card.name}</span>
                {card.manaCost && (
                  <span className="ml-auto shrink-0">
                    <ManaCost cost={card.manaCost} size={14} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* CTA */}
      <div className="glass-card border border-accent/20 rounded-2xl p-4 text-center">
        <p className="text-sm text-text-secondary mb-3">
          Built with MTG Houdini — deck building, life counter, AI coach and more.
        </p>
        <Link
          href="/"
          className="inline-block btn-gradient rounded-xl px-6 py-2.5 text-sm font-bold"
        >
          Try MTG Houdini
        </Link>
      </div>
    </main>
  );
}
