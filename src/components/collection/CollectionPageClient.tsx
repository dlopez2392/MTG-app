"use client";

import { useState } from "react";
import { useCollection } from "@/hooks/useCollection";
import CollectionSummary from "@/components/collection/CollectionSummary";
import BinderGrid from "@/components/collection/BinderGrid";
import Tabs from "@/components/ui/Tabs";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const TABS = [
  { value: "collection", label: "Collection" },
  { value: "lists", label: "Lists" },
];

export default function CollectionPageClient() {
  const [activeTab, setActiveTab] = useState("collection");
  const [showCreate, setShowCreate] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");

  const { allBinders, allCards, createBinder, deleteBinder } = useCollection();

  async function handleCreate() {
    const name = newBinderName.trim();
    if (!name) return;
    await createBinder(name);
    setNewBinderName("");
    setShowCreate(false);
  }

  async function handleDeleteBinder(id: string, name: string) {
    if (!confirm(`Delete binder "${name}"? All cards inside will be lost.`)) return;
    await deleteBinder(id);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-text-primary">Collection</h1>
      </div>

      <div className="px-4 pb-3">
        <CollectionSummary binders={allBinders} allCards={allCards} />
      </div>

      <div className="px-4 pb-3">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex-1 px-4">
        {activeTab === "collection" ? (
          <BinderGrid binders={allBinders} allCards={allCards} onDeleteBinder={handleDeleteBinder} />
        ) : (
          <div className="text-center py-12 text-text-muted text-sm">
            Lists coming soon
          </div>
        )}
      </div>

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-accent hover:bg-accent-dark text-black flex items-center justify-center shadow-lg transition-colors"
        aria-label="Create new binder"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

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
