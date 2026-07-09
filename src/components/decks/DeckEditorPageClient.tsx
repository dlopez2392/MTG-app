"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useDecks, useDeckCards } from "@/hooks/useDecks";
import { analyzeLocalBracket } from "@/lib/utils/bracketAnalysis";
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
  const { isSignedIn, isLoaded } = useUser();
  const { allDecks, deleteDeck, updateDeck } = useDecks();
  const { cards } = useDeckCards(deckId);
  const [deck, setDeck] = useState<Deck | undefined>();
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const found = allDecks.find((d) => d.id === deckId);
    if (found) setDeck(found);
  }, [deckId, allDecks]);

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
            {(() => {
              if (!cards || cards.length === 0) return null;
              const br = analyzeLocalBracket(cards);
              const BCOL: Record<number, string> = { 1: "#22C55E", 2: "#3B82F6", 3: "#F59E0B", 4: "#EF4444" };
              const BLAB: Record<number, string> = { 1: "Casual", 2: "Focused", 3: "Optimized", 4: "Competitive" };
              const c = BCOL[br.bracket] ?? "#22C55E";
              return (
                <button
                  onClick={() => router.push(`/decks/${deckId}/stats`)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: `${c}20` }}
                  title={`Bracket ${br.bracket} — ${BLAB[br.bracket]}`}
                >
                  <span className="text-xs font-black" style={{ color: c }}>{br.bracket}</span>
                  <span className="text-[10px] font-medium text-white/40">{BLAB[br.bracket]}</span>
                </button>
              );
            })()}
            {isLoaded && isSignedIn && (
              <>
                <button
                  onClick={async () => {
                    const next = !deck?.public;
                    await updateDeck(deckId, { public: next });
                    setDeck((d) => d ? { ...d, public: next } : d);
                  }}
                  className={`p-1.5 transition-colors ${deck?.public ? "text-accent" : "text-text-secondary hover:text-text-primary"}`}
                  title={deck?.public ? "Deck is public — anyone with the link can view it" : "Deck is private — click to make it shareable"}
                >
                  {deck?.public ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
                {deck?.public && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/d/${deckId}`);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className={`p-1.5 transition-colors ${linkCopied ? "text-legal" : "text-text-secondary hover:text-accent"}`}
                    title={linkCopied ? "Link copied!" : "Copy share link"}
                  >
                    {linkCopied ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                    )}
                  </button>
                )}
              </>
            )}
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
