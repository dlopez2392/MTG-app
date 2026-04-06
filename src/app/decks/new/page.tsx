"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDecks } from "@/hooks/useDecks";
import { FORMATS } from "@/lib/constants";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function NewDeckPage() {
  const router = useRouter();
  const { createDeck, updateDeck } = useDecks();
  const [name, setName] = useState("");
  const [format, setFormat] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const id = await createDeck(name.trim(), format || undefined);
      if (description.trim()) {
        await updateDeck(id, { description: description.trim() });
      }
      router.push(`/decks/${id}`);
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <TopBar title="New Deck" showBack />
      <PageContainer>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Deck Name <span className="text-banned">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter deck name"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full bg-bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              <option value="">No format</option>
              {FORMATS.map((f) => (
                <option key={f} value={f} className="capitalize">
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this deck about?"
              rows={3}
              className="w-full bg-bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <Button type="submit" disabled={!name.trim() || isSubmitting} size="lg">
            {isSubmitting ? "Creating..." : "Create Deck"}
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
