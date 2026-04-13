"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useCollection } from "@/hooks/useCollection";
import { useValueHistory } from "@/hooks/useValueHistory";
import HeroBanner from "@/components/layout/HeroBanner";
import CollectionSummary from "@/components/collection/CollectionSummary";
import ValueHistoryChart from "@/components/collection/ValueHistoryChart";
import CsvImportExport from "@/components/collection/CsvImportExport";
import BinderGrid from "@/components/collection/BinderGrid";
import SetCompletionTab from "@/components/collection/SetCompletionTab";
import Tabs from "@/components/ui/Tabs";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ConfirmModal from "@/components/ui/ConfirmModal";

const COLLECTION_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

const TABS = [
  { value: "collection", label: "Collection" },
  { value: "sets",       label: "Set Completion" },
];

export default function CollectionPageClient() {
  const [activeTab, setActiveTab] = useState("collection");
  const [showCreate, setShowCreate] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");
  const [binderToDelete, setBinderToDelete] = useState<{ id: string; name: string } | null>(null);

  const { allBinders, allCards, createBinder, deleteBinder, addCardToBinder } = useCollection();
  const { history, recordSnapshot } = useValueHistory();

  // Compute total value and record a daily snapshot
  const totalValue = useMemo(() => {
    return allCards.reduce((sum, c) => sum + parseFloat(c.priceUsd ?? "0") * c.quantity, 0);
  }, [allCards]);

  const totalCards = useMemo(() => {
    return allCards.reduce((sum, c) => sum + c.quantity, 0);
  }, [allCards]);

  useEffect(() => {
    if (allCards.length > 0) recordSnapshot(totalValue, totalCards);
  }, [totalValue, totalCards, recordSnapshot]);

  // CSV helpers
  const binderNameToId = useRef<Map<string, string>>(new Map());
  async function getOrCreateBinder(name: string): Promise<string> {
    const cached = binderNameToId.current.get(name);
    if (cached) return cached;
    const existing = allBinders.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (existing?.id) { binderNameToId.current.set(name, existing.id); return existing.id; }
    const id = await createBinder(name);
    binderNameToId.current.set(name, id);
    return id;
  }

  async function handleCreate() {
    const name = newBinderName.trim();
    if (!name) return;
    await createBinder(name);
    setNewBinderName("");
    setShowCreate(false);
  }

  function handleDeleteBinder(id: string, name: string) {
    setBinderToDelete({ id, name });
  }

  async function confirmDeleteBinder() {
    if (!binderToDelete) return;
    await deleteBinder(binderToDelete.id);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <HeroBanner
        title="Collection"
        subtitle="Track your card collection"
        accent="#22C55E"
        icon={COLLECTION_ICON}
      />

      <div className="px-4 pb-3">
        <CollectionSummary binders={allBinders} allCards={allCards} />
      </div>

      <div className="px-4 pb-3">
        <ValueHistoryChart history={history} />
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="flex-1" />
        <CsvImportExport
          allCards={allCards}
          allBinders={allBinders}
          getOrCreateBinder={getOrCreateBinder}
          addCard={async (binderId, row) => {
            await addCardToBinder(binderId, {
              scryfallId: row.scryfallId,
              name: row.name,
              quantity: row.quantity,
              condition: row.condition as import("@/types/collection").CardCondition,
              isFoil: row.foil,
              setCode: row.setCode || undefined,
              setName: row.setName || undefined,
              collectorNumber: row.collectorNumber || undefined,
              priceUsd: row.priceUsd || undefined,
              typeLine: row.typeLine || undefined,
              rarity: row.rarity as import("@/types/collection").CollectionCard["rarity"] || undefined,
            });
          }}
        />
      </div>

      <div className="flex-1 px-4">
        {activeTab === "collection" ? (
          <BinderGrid binders={allBinders} allCards={allCards} onDeleteBinder={handleDeleteBinder} />
        ) : (
          <SetCompletionTab allCards={allCards} />
        )}
      </div>

      {activeTab === "collection" && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-accent hover:bg-accent-dark text-black flex items-center justify-center shadow-lg transition-colors"
          aria-label="Create new binder"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      <ConfirmModal
        open={!!binderToDelete}
        onClose={() => setBinderToDelete(null)}
        onConfirm={confirmDeleteBinder}
        title="Delete Binder"
        description={`Delete "${binderToDelete?.name}"? All cards inside will be lost.`}
        confirmLabel="Delete"
        danger
      />

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setNewBinderName(""); }}
        title="New Binder"
      >
        <div className="space-y-4">
          <Input
            placeholder="Binder name..."
            value={newBinderName}
            onChange={(e) => setNewBinderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => { setShowCreate(false); setNewBinderName(""); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newBinderName.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
