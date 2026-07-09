import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

interface GuestDeckCard {
  scryfallId: string; name: string; quantity: number; category: string;
  manaCost?: string; cmc?: number; typeLine?: string; rarity?: string;
  imageUri?: string; priceUsd?: string | null;
}
interface GuestBinderCard {
  scryfallId: string; name: string; quantity: number; condition?: string;
  isFoil?: boolean; setCode?: string; setName?: string; collectorNumber?: string;
  imageUri?: string; priceUsd?: string | null; typeLine?: string; rarity?: string;
}
interface MergeBody {
  decks?: { deck: { name: string; format?: string; description?: string; coverCardId?: string; coverImageUri?: string }; cards: GuestDeckCard[] }[];
  binders?: { binder: { name: string; description?: string; coverImageUri?: string }; cards: GuestBinderCard[] }[];
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const BATCH = 50;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: MergeBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decks = body.decks ?? [];
  const binders = body.binders ?? [];
  if (decks.length === 0 && binders.length === 0) {
    return NextResponse.json({ error: "Nothing to merge" }, { status: 400 });
  }

  const sb = getSupabase();
  const now = new Date().toISOString();
  const errors: string[] = [];
  let deckCount = 0;
  let binderCount = 0;
  let cardCount = 0;

  // ── Decks ──
  for (const { deck, cards } of decks) {
    if (!deck?.name) { errors.push("Skipped a deck with no name"); continue; }
    const { data: row, error: deckError } = await sb
      .from("decks")
      .insert({
        user_id: userId,
        name: deck.name,
        format: deck.format ?? null,
        description: deck.description ?? null,
        cover_card_id: deck.coverCardId ?? null,
        cover_image_uri: deck.coverImageUri ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (deckError || !row) {
      errors.push(`Deck "${deck.name}": ${deckError?.message ?? "insert failed"}`);
      continue;
    }
    deckCount++;

    const cardRows = (cards ?? [])
      .filter((c) => c.scryfallId && c.name)
      .map((c) => ({
        deck_id: row.id,
        user_id: userId,
        scryfall_id: c.scryfallId,
        name: c.name,
        quantity: c.quantity ?? 1,
        category: c.category ?? "main",
        mana_cost: c.manaCost ?? null,
        cmc: c.cmc ?? null,
        type_line: c.typeLine ?? null,
        rarity: c.rarity ?? null,
        image_uri: c.imageUri ?? null,
        price_usd: c.priceUsd ?? null,
      }));
    for (let i = 0; i < cardRows.length; i += BATCH) {
      const batch = cardRows.slice(i, i + BATCH);
      const { error: cardError } = await sb.from("deck_cards").insert(batch);
      if (cardError) errors.push(`Deck "${deck.name}" cards: ${cardError.message}`);
      else cardCount += batch.length;
    }
  }

  // ── Binders ──
  for (const { binder, cards } of binders) {
    if (!binder?.name) { errors.push("Skipped a binder with no name"); continue; }
    const { data: row, error: binderError } = await sb
      .from("binders")
      .insert({
        user_id: userId,
        name: binder.name,
        description: binder.description ?? null,
        cover_image_uri: binder.coverImageUri ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (binderError || !row) {
      errors.push(`Binder "${binder.name}": ${binderError?.message ?? "insert failed"}`);
      continue;
    }
    binderCount++;

    const fullRows = (cards ?? [])
      .filter((c) => c.scryfallId && c.name)
      .map((c) => ({
        binder_id: row.id,
        user_id: userId,
        scryfall_id: c.scryfallId,
        name: c.name,
        quantity: c.quantity ?? 1,
        foil: c.isFoil ?? false,
        condition: c.condition ?? "near_mint",
        set_code: c.setCode ?? null,
        set_name: c.setName ?? null,
        collector_number: c.collectorNumber ?? null,
        image_uri: c.imageUri ?? null,
        price_usd: c.priceUsd ?? null,
        type_line: c.typeLine ?? null,
        rarity: c.rarity ?? null,
      }));
    for (let i = 0; i < fullRows.length; i += BATCH) {
      let batch: Record<string, unknown>[] = fullRows.slice(i, i + BATCH);
      let { error: cardError } = await sb.from("collection_cards").insert(batch);
      // Older schema fallback (mirrors /api/binders/[id]/cards): retry without optional columns
      if (cardError && (cardError.message.includes("collector_number") || cardError.message.includes("type_line") || cardError.message.includes("rarity"))) {
        batch = batch.map((r) => {
          const { collector_number, type_line, rarity, ...core } = r;
          void collector_number; void type_line; void rarity;
          return core;
        });
        ({ error: cardError } = await sb.from("collection_cards").insert(batch));
      }
      if (cardError) errors.push(`Binder "${binder.name}" cards: ${cardError.message}`);
      else cardCount += batch.length;
    }
  }

  return NextResponse.json({ decks: deckCount, binders: binderCount, cards: cardCount, errors });
}
