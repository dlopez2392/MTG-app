"use client";

import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import { cn } from "@/lib/utils/cn";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

type Category = "bug" | "feature" | "general";

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "bug",     label: "Bug Report",       emoji: "🐛" },
  { value: "feature", label: "Feature Request",  emoji: "✨" },
  { value: "general", label: "General Feedback", emoji: "💬" },
];

type Status = "idle" | "sending" | "success" | "error";

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState<Category>("bug");
  const [name,     setName]     = useState("");
  const [message,  setMessage]  = useState("");
  const [status,   setStatus]   = useState<Status>("idle");

  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_URL;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    try {
      const res = await fetch(endpoint!, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name:     name.trim() || "Anonymous",
          category: CATEGORIES.find((c) => c.value === category)?.label,
          message:  message.trim(),
        }),
      });

      if (res.ok) {
        setStatus("success");
        setTimeout(() => {
          setStatus("idle");
          setName("");
          setMessage("");
          setCategory("bug");
          onClose();
        }, 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  function handleClose() {
    if (status === "sending") return;
    setStatus("idle");
    setName("");
    setMessage("");
    setCategory("bug");
    onClose();
  }

  // Formspree URL not configured
  if (!endpoint) {
    return (
      <Modal open={open} onClose={onClose} title="Send Feedback">
        <p className="text-body text-text-secondary mb-3">
          Feedback submission isn&apos;t configured yet.
        </p>
        <p className="text-caption mb-4">
          Add <code className="bg-bg-hover px-1 py-0.5 rounded text-accent text-xs">NEXT_PUBLIC_FORMSPREE_URL</code> to your <code className="bg-bg-hover px-1 py-0.5 rounded text-accent text-xs">.env.local</code> file.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Send Feedback">
      {status === "success" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full bg-legal/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-legal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-body font-medium text-text-primary">Thanks for the feedback!</p>
          <p className="text-caption text-center">Your message has been sent.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category pills */}
          <div>
            <p className="text-section-label text-text-muted mb-2">Category</p>
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    category === cat.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg-card text-text-secondary hover:border-border/80 hover:text-text-primary"
                  )}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="leading-tight text-center">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name (optional) */}
          <div>
            <p className="text-section-label text-text-muted mb-1.5">Your name <span className="normal-case font-normal">(optional)</span></p>
            <Input
              placeholder="e.g. Dan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Message */}
          <div>
            <p className="text-section-label text-text-muted mb-1.5">Message</p>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === "bug"
                  ? "Describe what happened and how to reproduce it…"
                  : category === "feature"
                  ? "Describe the feature you'd like to see…"
                  : "Share your thoughts…"
              }
              className="w-full bg-bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/50 resize-none transition-colors"
            />
          </div>

          {status === "error" && (
            <p className="text-xs text-banned">Something went wrong. Please try again.</p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={status === "sending"}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!message.trim() || status === "sending"}
            >
              {status === "sending" ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending…
                </span>
              ) : "Send Feedback"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
