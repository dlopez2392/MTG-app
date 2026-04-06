import Dexie, { type EntityTable } from "dexie";
import type { Deck, DeckCard, DeckFolder } from "@/types/deck";
import type { Binder, CollectionCard } from "@/types/collection";
import type { LifeGame } from "@/types/life";

const db = new Dexie("mtg-houdini") as Dexie & {
  decks: EntityTable<Deck, "id">;
  deckCards: EntityTable<DeckCard, "id">;
  deckFolders: EntityTable<DeckFolder, "id">;
  binders: EntityTable<Binder, "id">;
  collectionCards: EntityTable<CollectionCard, "id">;
  lifeGames: EntityTable<LifeGame, "id">;
};

db.version(1).stores({
  decks: "++id, name, format, folderId, createdAt",
  deckCards: "++id, deckId, scryfallId, name, category",
  deckFolders: "++id, name, parentId",
  binders: "++id, name, createdAt",
  collectionCards: "++id, binderId, scryfallId, name",
  lifeGames: "++id, createdAt",
});

export { db };
