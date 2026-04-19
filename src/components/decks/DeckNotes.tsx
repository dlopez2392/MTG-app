"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

interface DeckNotesProps {
  deckId: string;
  initialValue?: string;
  onSave: (notes: string) => Promise<void>;
}

// ── Lightweight markdown renderer ─────────────────────────────────────────────
// Supports: # headings, **bold**, *italic*, - list items, blank-line paragraphs
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text.trim()) return [];

  const paragraphs = text.split(/\n{2,}/);
  const nodes: React.ReactNode[] = [];

  paragraphs.forEach((block, pIdx) => {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) return;

    // List block
    const isList = lines.every((l) => /^[-*]\s/.test(l));
    if (isList) {
      nodes.push(
        <ul key={pIdx} className="list-disc pl-4 space-y-0.5 text-sm text-text-secondary">
          {lines.map((l, i) => (
            <li key={i}>{inlineMarkdown(l.replace(/^[-*]\s/, ""))}</li>
          ))}
        </ul>
      );
      return;
    }

    // Heading (# or ##)
    if (/^#{1,2}\s/.test(lines[0])) {
      const level = lines[0].match(/^(#{1,2})/)?.[1].length ?? 1;
      const content = lines[0].replace(/^#{1,2}\s/, "");
      nodes.push(
        <p key={pIdx} className={cn(
          "font-bold text-text-primary",
          level === 1 ? "text-base" : "text-sm"
        )}>
          {inlineMarkdown(content)}
        </p>
      );
      return;
    }

    // Regular paragraph (join lines with space)
    nodes.push(
      <p key={pIdx} className="text-sm text-text-secondary leading-relaxed">
        {lines.map((l, i) => (
          <span key={i}>{i > 0 && <br />}{inlineMarkdown(l)}</span>
        ))}
      </p>
    );
  });

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode[] {
  // Handle **bold** and *italic*
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) {
      parts.push(<strong key={m.index} className="font-semibold text-text-primary">{m[2]}</strong>);
    } else if (m[3]) {
      parts.push(<em key={m.index}>{m[3]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeckNotes({ deckId, initialValue = "", onSave }: DeckNotesProps) {
  const [expanded, setExpanded] = useState(!!initialValue);
  const [editing, setEditing]   = useState(false);
  const [value, setValue]       = useState(initialValue);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local value in sync if parent deck reloads
  useEffect(() => { setValue(initialValue); }, [initialValue]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const handleSave = useCallback(async (text: string) => {
    if (text === initialValue) return;
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setSaved(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaved(false), 2000);
  }, [initialValue, onSave]);

  function handleBlur() {
    setEditing(false);
    handleSave(value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setEditing(false);
      handleSave(value);
    }
  }

  const isEmpty = !value.trim();
  const rendered = renderMarkdown(value);

  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-hover/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          <span className="text-section-label text-text-primary">Notes</span>
          {!isEmpty && (
            <span className="text-[10px] text-text-muted font-normal normal-case tracking-normal">
              {value.trim().length} chars
            </span>
          )}
          {saved && (
            <span className="text-[10px] text-legal">Saved</span>
          )}
        </div>
        <svg
          className={cn("w-4 h-4 text-text-muted transition-transform duration-200", expanded ? "rotate-180" : "")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          {editing ? (
            <div className="mt-3">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={"Add strategy notes, sideboard guide, card explanations…\n\nSupports basic markdown:\n**bold**  *italic*\n# Heading\n- List item"}
                rows={8}
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/60 resize-none transition-colors leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-text-muted">Esc or click away to save</p>
                <button
                  onClick={handleBlur}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-xl bg-accent text-black text-xs font-bold hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="mt-3 cursor-text min-h-[48px]"
              onClick={() => setEditing(true)}
            >
              {isEmpty ? (
                <p className="text-sm text-text-muted italic">
                  Tap to add strategy notes, sideboard guide, card explanations…
                </p>
              ) : (
                <div className="space-y-2">{rendered}</div>
              )}
            </div>
          )}

          {/* Markdown hint */}
          {editing && (
            <p className="mt-1 text-[10px] text-text-muted">
              Markdown: <code className="text-accent">**bold**</code> &nbsp;
              <code className="text-accent">*italic*</code> &nbsp;
              <code className="text-accent"># Heading</code> &nbsp;
              <code className="text-accent">- list item</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
