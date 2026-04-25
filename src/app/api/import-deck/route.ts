import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

interface ImportCard {
  name: string;
  quantity: number;
  category: "main" | "sideboard" | "commander" | "companion" | "maybeboard";
  scryfallId?: string;
}

// ── Archidekt deck fetch ──

interface ArchidektCardEntry {
  quantity: number;
  card: { oracleCard: { name: string }; uid: string };
  categories: string[];
}

function archidektCategory(cats: string[]): ImportCard["category"] {
  const joined = cats.join(",").toLowerCase();
  if (joined.includes("commander")) return "commander";
  if (joined.includes("sideboard")) return "sideboard";
  if (joined.includes("companion")) return "companion";
  if (joined.includes("maybeboard")) return "maybeboard";
  return "main";
}

async function fetchArchidektDeck(deckId: string): Promise<{ name: string; format: string; cards: ImportCard[] }> {
  const res = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
    headers: { Accept: "application/json", "User-Agent": "MTGHoudini/1.0" },
  });
  if (!res.ok) throw new Error(`Archidekt returned ${res.status}`);
  const data = await res.json();

  const formatMap: Record<number, string> = { 1: "standard", 3: "commander", 4: "modern", 5: "legacy", 6: "vintage", 12: "pauper", 14: "pioneer" };
  const format = formatMap[data.deckFormat] ?? "commander";

  const cards: ImportCard[] = (data.cards ?? []).map((entry: ArchidektCardEntry) => ({
    name: entry.card?.oracleCard?.name ?? "",
    quantity: entry.quantity ?? 1,
    category: archidektCategory(entry.categories ?? []),
  })).filter((c: ImportCard) => c.name);

  return { name: data.name ?? "Imported Deck", format, cards };
}

// ── Moxfield deck fetch ──

interface MoxfieldCardEntry {
  quantity: number;
  card: { name: string; scryfall_id: string };
}

type MoxfieldBoard = Record<string, MoxfieldCardEntry>;

function parseMoxfieldBoard(board: MoxfieldBoard | undefined, category: ImportCard["category"]): ImportCard[] {
  if (!board) return [];
  return Object.values(board).map((entry) => ({
    name: entry.card?.name ?? "",
    quantity: entry.quantity ?? 1,
    category,
    scryfallId: entry.card?.scryfall_id,
  })).filter((c) => c.name);
}

async function fetchMoxfieldDeck(deckId: string): Promise<{ name: string; format: string; cards: ImportCard[] }> {
  const res = await fetch(`https://api2.moxfield.com/v2/decks/all/${deckId}`, {
    headers: { Accept: "application/json", "User-Agent": "MTGHoudini/1.0" },
  });
  if (!res.ok) throw new Error(`Moxfield returned ${res.status}`);
  const data = await res.json();

  const cards: ImportCard[] = [
    ...parseMoxfieldBoard(data.boards?.mainboard, "main"),
    ...parseMoxfieldBoard(data.boards?.sideboard, "sideboard"),
    ...parseMoxfieldBoard(data.boards?.commanders, "commander"),
    ...parseMoxfieldBoard(data.boards?.companions, "companion"),
    ...parseMoxfieldBoard(data.boards?.maybeboard, "maybeboard"),
  ];

  return { name: data.name ?? "Imported Deck", format: data.format ?? "commander", cards };
}

// ── Scryfall resolution ──

interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  rarity?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
  prices?: { usd?: string | null };
}

async function resolveCards(cards: ImportCard[]): Promise<(ImportCard & { resolved: ScryfallCard })[]> {
  const resolved: (ImportCard & { resolved: ScryfallCard })[] = [];
  const toResolve = cards.filter((c) => !c.scryfallId);
  const alreadyResolved = cards.filter((c) => c.scryfallId);

  // Cards with scryfall IDs — batch fetch by ID
  const CHUNK = 75;
  for (let i = 0; i < alreadyResolved.length; i += CHUNK) {
    const chunk = alreadyResolved.slice(i, i + CHUNK);
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((c) => ({ id: c.scryfallId })) }),
    });
    if (res.ok) {
      const data = await res.json();
      const found = new Map<string, ScryfallCard>((data.data ?? []).map((c: ScryfallCard) => [c.id, c]));
      for (const card of chunk) {
        const sc = found.get(card.scryfallId!);
        if (sc) resolved.push({ ...card, resolved: sc });
      }
    }
    if (i + CHUNK < alreadyResolved.length) await new Promise((r) => setTimeout(r, 100));
  }

  // Cards without IDs — resolve by name
  for (let i = 0; i < toResolve.length; i += CHUNK) {
    const chunk = toResolve.slice(i, i + CHUNK);
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((c) => ({ name: c.name })) }),
    });
    if (res.ok) {
      const data = await res.json();
      const found = new Map<string, ScryfallCard>((data.data ?? []).map((c: ScryfallCard) => [c.name.toLowerCase(), c]));
      for (const card of chunk) {
        const sc = found.get(card.name.toLowerCase());
        if (sc) resolved.push({ ...card, resolved: sc });
      }
    }
    if (i + CHUNK < toResolve.length) await new Promise((r) => setTimeout(r, 100));
  }

  return resolved;
}

// ── Route ──

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { source, deckId } = body as { source: string; deckId: string };

  if (!source || !deckId) {
    return NextResponse.json({ error: "source and deckId are required" }, { status: 400 });
  }

  try {
    // 1. Fetch deck from external source
    let deckData: { name: string; format: string; cards: ImportCard[] };
    if (source === "archidekt") {
      deckData = await fetchArchidektDeck(deckId);
    } else if (source === "moxfield") {
      deckData = await fetchMoxfieldDeck(deckId);
    } else {
      return NextResponse.json({ error: "Unsupported source" }, { status: 400 });
    }

    if (deckData.cards.length === 0) {
      return NextResponse.json({ error: "Deck has no cards" }, { status: 400 });
    }

    // 2. Resolve cards via Scryfall
    const resolved = await resolveCards(deckData.cards);

    // 3. Create deck in DB
    const sb = getSupabase();
    const now = new Date().toISOString();

    const firstCard = resolved.find((c) => c.resolved.image_uris?.normal || c.resolved.card_faces?.[0]?.image_uris?.normal);
    const coverUri = firstCard?.resolved.image_uris?.normal ?? firstCard?.resolved.card_faces?.[0]?.image_uris?.normal ?? null;

    const { data: deck, error: deckError } = await sb
      .from("decks")
      .insert({
        user_id: userId,
        name: deckData.name,
        format: deckData.format,
        cover_image_uri: coverUri,
        cover_card_id: firstCard?.resolved.id ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (deckError) return NextResponse.json({ error: deckError.message }, { status: 500 });

    // 4. Insert all cards
    const cardRows = resolved.map((c) => ({
      deck_id: deck.id,
      user_id: userId,
      scryfall_id: c.resolved.id,
      name: c.resolved.name,
      quantity: c.quantity,
      category: c.category,
      mana_cost: c.resolved.mana_cost ?? null,
      cmc: c.resolved.cmc ?? null,
      type_line: c.resolved.type_line ?? null,
      rarity: c.resolved.rarity ?? null,
      image_uri: c.resolved.image_uris?.normal ?? c.resolved.card_faces?.[0]?.image_uris?.normal ?? null,
      price_usd: c.resolved.prices?.usd ?? null,
    }));

    // Insert in batches of 50
    const BATCH = 50;
    let insertedCount = 0;
    for (let i = 0; i < cardRows.length; i += BATCH) {
      const batch = cardRows.slice(i, i + BATCH);
      const { error: cardError } = await sb.from("deck_cards").insert(batch);
      if (!cardError) insertedCount += batch.length;
    }

    return NextResponse.json({
      deckId: deck.id,
      name: deckData.name,
      format: deckData.format,
      totalCards: deckData.cards.length,
      importedCards: insertedCount,
      skippedCards: deckData.cards.length - resolved.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
