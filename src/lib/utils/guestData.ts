// Guest data lives in localStorage under these keys (written by useDecks/useCollection):
//   mtg_guest_decks                      Deck[]
//   mtg_guest_deck_cards_{deckId}        DeckCard[]
//   mtg_guest_binders                    Binder[]
//   mtg_guest_binder_cards_{binderId}    CollectionCard[]

export interface GuestDeckMeta {
  name: string;
  format?: string;
  description?: string;
  coverCardId?: string;
  coverImageUri?: string;
}

export interface GuestDeckCard {
  scryfallId: string;
  name: string;
  quantity: number;
  category: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  rarity?: string;
  imageUri?: string;
  priceUsd?: string | null;
}

export interface GuestBinderMeta {
  name: string;
  description?: string;
  coverImageUri?: string;
}

export interface GuestBinderCard {
  scryfallId: string;
  name: string;
  quantity: number;
  condition?: string;
  isFoil?: boolean;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
  priceUsd?: string | null;
  typeLine?: string;
  rarity?: string;
}

export interface GuestMergePayload {
  decks: { deck: GuestDeckMeta; cards: GuestDeckCard[] }[];
  binders: { binder: GuestBinderMeta; cards: GuestBinderCard[] }[];
}

const DECKS_KEY = "mtg_guest_decks";
const BINDERS_KEY = "mtg_guest_binders";
const DECK_CARDS_PREFIX = "mtg_guest_deck_cards_";
const BINDER_CARDS_PREFIX = "mtg_guest_binder_cards_";
const DISMISSED_KEY = "mtg_guest_merge_dismissed";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}

interface StoredDeck { id?: string; name: string; format?: string; description?: string; coverCardId?: string; coverImageUri?: string }
interface StoredBinder { id?: string; name: string; description?: string; coverImageUri?: string }

export function guestDataSummary(): { decks: number; binders: number; cards: number } {
  const decks = lsGet<StoredDeck[]>(DECKS_KEY, []);
  const binders = lsGet<StoredBinder[]>(BINDERS_KEY, []);
  let cards = 0;
  for (const d of decks) cards += lsGet<unknown[]>(`${DECK_CARDS_PREFIX}${d.id}`, []).length;
  for (const b of binders) cards += lsGet<unknown[]>(`${BINDER_CARDS_PREFIX}${b.id}`, []).length;
  return { decks: decks.length, binders: binders.length, cards };
}

export function hasGuestData(): boolean {
  const s = guestDataSummary();
  return s.decks > 0 || s.binders > 0;
}

export function collectGuestData(): GuestMergePayload {
  const decks = lsGet<StoredDeck[]>(DECKS_KEY, []);
  const binders = lsGet<StoredBinder[]>(BINDERS_KEY, []);
  return {
    decks: decks.map((d) => ({
      deck: {
        name: d.name || "Untitled Deck",
        format: d.format,
        description: d.description,
        coverCardId: d.coverCardId,
        coverImageUri: d.coverImageUri,
      },
      cards: lsGet<GuestDeckCard[]>(`${DECK_CARDS_PREFIX}${d.id}`, []).map((c) => ({
        scryfallId: c.scryfallId,
        name: c.name,
        quantity: c.quantity,
        category: c.category,
        manaCost: c.manaCost,
        cmc: c.cmc,
        typeLine: c.typeLine,
        rarity: c.rarity,
        imageUri: c.imageUri,
        priceUsd: c.priceUsd,
      })),
    })),
    binders: binders.map((b) => ({
      binder: {
        name: b.name || "Untitled Binder",
        description: b.description,
        coverImageUri: b.coverImageUri,
      },
      cards: lsGet<GuestBinderCard[]>(`${BINDER_CARDS_PREFIX}${b.id}`, []).map((c) => ({
        scryfallId: c.scryfallId,
        name: c.name,
        quantity: c.quantity,
        condition: c.condition,
        isFoil: c.isFoil,
        setCode: c.setCode,
        setName: c.setName,
        collectorNumber: c.collectorNumber,
        imageUri: c.imageUri,
        priceUsd: c.priceUsd,
        typeLine: c.typeLine,
        rarity: c.rarity,
      })),
    })),
  };
}

export function clearGuestData(): void {
  if (typeof window === "undefined") return;
  const decks = lsGet<StoredDeck[]>(DECKS_KEY, []);
  const binders = lsGet<StoredBinder[]>(BINDERS_KEY, []);
  for (const d of decks) localStorage.removeItem(`${DECK_CARDS_PREFIX}${d.id}`);
  for (const b of binders) localStorage.removeItem(`${BINDER_CARDS_PREFIX}${b.id}`);
  localStorage.removeItem(DECKS_KEY);
  localStorage.removeItem(BINDERS_KEY);
}

export function isMergeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

export function dismissMerge(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_KEY, "1");
}
