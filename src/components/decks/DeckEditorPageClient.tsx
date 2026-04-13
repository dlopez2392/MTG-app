"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDecks } from "@/hooks/useDecks";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import DeckEditor from "@/components/decks/DeckEditor";
import DeckNotes from "@/components/decks/DeckNotes";
import type { Deck } from "@/types/deck";

interface Props {
  deckId: string;
}

export default function DeckEditorPageClient({ deckId }: Props) {
  const router = useRouter();
  const { getDeck, deleteDeck, updateDeck } = useDecks();
  const [deck, setDeck] = useState<Deck | undefined>();

  useEffect(() => {
    getDeck(deckId).then(setDeck);
  }, [deckId]);

  async function handleDelete() {
    if (!confirm("Delete this deck? This cannot be undone.")) return;
    await deleteDeck(deckId);
    router.push("/decks");
  }

  return (
    <>
      <TopBar
        title={deck?.name ?? "Deck"}
        showBack
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/games?deck=${encodeURIComponent(deck?.name ?? "")}&deckId=${deckId}`)}
              className="p-1.5 text-text-secondary hover:text-legal transition-colors"
              title="Log a game"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </button>
            <button
              onClick={() => router.push(`/decks/${deckId}/stats`)}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              title="Deck stats"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-text-secondary hover:text-banned transition-colors"
              title="Delete deck"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        }
      />
      <PageContainer>
        <DeckEditor deckId={deckId} />
        <div className="mt-4">
          <DeckNotes
            deckId={deckId}
            initialValue={deck?.description ?? ""}
            onSave={async (notes) => {
              await updateDeck(deckId, { description: notes });
              setDeck((d) => d ? { ...d, description: notes } : d);
            }}
          />
        </div>
      </PageContainer>
    </>
  );
}
