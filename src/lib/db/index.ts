import Dexie from "dexie";
import type { Deck, DeckCard, DeckFolder } from "@/types/deck";
import type { Binder, CollectionCard } from "@/types/collection";
import type { LifeGame } from "@/types/life";

export type AppDatabase = {
  decks: import("dexie").EntityTable<Deck, "id">;
  deckCards: import("dexie").EntityTable<DeckCard, "id">;
  deckFolders: import("dexie").EntityTable<DeckFolder, "id">;
  binders: import("dexie").EntityTable<Binder, "id">;
  collectionCards: import("dexie").EntityTable<CollectionCard, "id">;
  lifeGames: import("dexie").EntityTable<LifeGame, "id">;
} & Dexie;

let _db: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (typeof window === "undefined") {
    throw new Error("getDb() can only be called in the browser");
  }
  if (!_db) {
    _db = new Dexie("mtg-houdini") as AppDatabase;
    _db.version(1).stores({
      decks: "++id, name, format, folderId, createdAt",
      deckCards: "++id, deckId, scryfallId, name, category",
      deckFolders: "++id, name, parentId",
      binders: "++id, name, createdAt",
      collectionCards: "++id, binderId, scryfallId, name",
      lifeGames: "++id, createdAt",
    });
    _db.version(2).stores({
      decks: "++id, name, format, folderId, createdAt, updatedAt",
    });
  }
  return _db;
}
