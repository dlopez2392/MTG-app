import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

interface AllocationEntry {
  scryfallId: string;
  name: string;
  imageUri: string | null;
  ownedQty: number;
  totalNeeded: number;
  decks: { deckId: string; deckName: string; quantity: number }[];
  binders: { binderId: string; binderName: string; quantity: number }[];
  conflict: boolean;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();

  const [decksRes, deckCardsRes, bindersRes, collectionRes] = await Promise.all([
    sb.from("decks").select("id, name").eq("user_id", userId),
    sb.from("deck_cards").select("scryfall_id, name, quantity, deck_id, image_uri").eq("user_id", userId),
    sb.from("binders").select("id, name").eq("user_id", userId),
    sb.from("collection_cards").select("scryfall_id, name, quantity, binder_id, image_uri").eq("user_id", userId),
  ]);

  if (decksRes.error || deckCardsRes.error || bindersRes.error || collectionRes.error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  const deckNameMap = new Map<string, string>();
  for (const d of decksRes.data) deckNameMap.set(d.id, d.name);

  const binderNameMap = new Map<string, string>();
  for (const b of bindersRes.data) binderNameMap.set(b.id, b.name);

  const allocationMap = new Map<string, AllocationEntry>();

  for (const dc of deckCardsRes.data) {
    const entry: AllocationEntry = allocationMap.get(dc.scryfall_id) ?? {
      scryfallId: dc.scryfall_id,
      name: dc.name,
      imageUri: dc.image_uri,
      ownedQty: 0,
      totalNeeded: 0,
      decks: [],
      binders: [],
      conflict: false,
    };

    entry.totalNeeded += dc.quantity;
    entry.decks.push({
      deckId: dc.deck_id,
      deckName: deckNameMap.get(dc.deck_id) ?? "Unknown",
      quantity: dc.quantity,
    });

    if (!entry.imageUri && dc.image_uri) entry.imageUri = dc.image_uri;
    allocationMap.set(dc.scryfall_id, entry);
  }

  for (const cc of collectionRes.data) {
    const entry = allocationMap.get(cc.scryfall_id);
    if (entry) {
      entry.ownedQty += cc.quantity;
      entry.binders.push({
        binderId: cc.binder_id,
        binderName: binderNameMap.get(cc.binder_id) ?? "Unknown",
        quantity: cc.quantity,
      });
    }
  }

  const allocations: AllocationEntry[] = [];
  for (const entry of allocationMap.values()) {
    if (entry.decks.length >= 2 || entry.ownedQty < entry.totalNeeded) {
      entry.conflict = entry.ownedQty < entry.totalNeeded;
      allocations.push(entry);
    }
  }

  allocations.sort((a, b) => {
    if (a.conflict !== b.conflict) return a.conflict ? -1 : 1;
    return b.decks.length - a.decks.length;
  });

  return NextResponse.json({
    allocations,
    totalShared: allocations.filter((a) => a.decks.length >= 2).length,
    totalConflicts: allocations.filter((a) => a.conflict).length,
  });
}
