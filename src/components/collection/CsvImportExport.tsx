"use client";

import { useRef, useState, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { collectionToCsv, parseCsv } from "@/lib/utils/csv";
import { cn } from "@/lib/utils/cn";
import type { CollectionCard, Binder, CardCondition } from "@/types/collection";
import type { CsvRow } from "@/lib/utils/csv";

interface Props {
  allCards: CollectionCard[];
  allBinders: Binder[];
  /** Called to resolve a binder name → id, creating the binder if needed */
  getOrCreateBinder: (name: string) => Promise<string>;
  /** Called once per card row to add it */
  addCard: (binderId: string, row: CsvRow) => Promise<void>;
  onDone?: () => void;
}

type ImportStep = "idle" | "preview" | "importing" | "done";

const VALID_CONDITIONS = new Set([
  "mint", "near_mint", "lightly_played",
  "moderately_played", "heavily_played", "damaged",
]);

function normalizeCondition(raw: string): CardCondition {
  const s = raw.toLowerCase().replace(/\s+/g, "_");
  if (VALID_CONDITIONS.has(s)) return s as CardCondition;
  // Common abbreviations
  const map: Record<string, CardCondition> = {
    nm: "near_mint", m: "mint", lp: "lightly_played",
    mp: "moderately_played", hp: "heavily_played", d: "damaged",
    sp: "lightly_played", // some tools use SP
  };
  return map[s] ?? "near_mint";
}

// Resolve scryfallId for a row that lacks one
async function lookupScryfallId(row: CsvRow): Promise<string | null> {
  try {
    let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(row.name)}`;
    if (row.setCode) url += `&set=${encodeURIComponent(row.setCode)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

export default function CsvImportExport({
  allCards, allBinders, getOrCreateBinder, addCard, onDone,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("idle");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // ── Export ──────────────────────────────────────────────────────────────────
  function handleExport() {
    const csv = collectionToCsv(allCards, allBinders);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mtg-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import — file picked ───────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, errors } = parseCsv(text);
      setRows(parsed);
      setParseErrors(errors);
      setStep("preview");
    };
    reader.readAsText(file);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  // ── Import — run ───────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    setStep("importing");
    setProgress({ done: 0, total: rows.length, failed: 0 });
    const errs: string[] = [];
    const binderCache = new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Resolve binder
        const binderName = row.binder || "Default";
        if (!binderCache.has(binderName)) {
          const id = await getOrCreateBinder(binderName);
          binderCache.set(binderName, id);
        }
        const binderId = binderCache.get(binderName)!;

        // Resolve scryfallId if missing
        let scryfallId = row.scryfallId;
        if (!scryfallId) {
          scryfallId = (await lookupScryfallId(row)) ?? "";
          if (!scryfallId) throw new Error(`Couldn't find "${row.name}" on Scryfall`);
          // Small delay to respect Scryfall rate limit
          await new Promise((r) => setTimeout(r, 80));
        }

        await addCard(binderId, { ...row, scryfallId, condition: normalizeCondition(row.condition) });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch (err) {
        errs.push(`Row ${i + 2} "${row.name}": ${err instanceof Error ? err.message : "Unknown error"}`);
        setProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
      }
    }

    setImportErrors(errs);
    setStep("done");
    onDone?.();
  }, [rows, getOrCreateBinder, addCard, onDone]);

  function handleClose() {
    setStep("idle");
    setRows([]);
    setParseErrors([]);
    setImportErrors([]);
    setProgress({ done: 0, total: 0, failed: 0 });
  }

  const needsLookup = rows.filter((r) => !r.scryfallId).length;

  return (
    <>
      {/* Trigger buttons */}
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={handleExport}
          disabled={allCards.length === 0}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export collection as CSV"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
          title="Import collection from CSV"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5V21" />
          </svg>
          <span className="hidden sm:inline">Import</span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Preview / progress modal */}
      <Modal
        open={step !== "idle"}
        onClose={step === "importing" ? () => {} : handleClose}
        title={
          step === "preview"   ? "Import Preview" :
          step === "importing" ? "Importing…"     :
                                 "Import Complete"
        }
      >
        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-card rounded-lg p-3 text-center border border-border">
                <p className="text-xl font-bold text-text-primary">{rows.length}</p>
                <p className="text-[10px] text-text-muted">Rows</p>
              </div>
              <div className="bg-bg-card rounded-lg p-3 text-center border border-border">
                <p className="text-xl font-bold text-text-primary">{rows.length - needsLookup}</p>
                <p className="text-[10px] text-text-muted">Has ID</p>
              </div>
              <div className={cn(
                "rounded-lg p-3 text-center border",
                needsLookup > 0 ? "bg-restricted/10 border-restricted/30" : "bg-bg-card border-border"
              )}>
                <p className={cn("text-xl font-bold", needsLookup > 0 ? "text-restricted" : "text-text-primary")}>
                  {needsLookup}
                </p>
                <p className="text-[10px] text-text-muted">Need lookup</p>
              </div>
            </div>

            {needsLookup > 0 && (
              <p className="text-xs text-text-secondary">
                {needsLookup} row{needsLookup !== 1 ? "s" : ""} without a Scryfall ID will be looked up by name (may take a moment).
              </p>
            )}

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="bg-banned/10 border border-banned/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-banned mb-1">Parse warnings ({parseErrors.length})</p>
                <ul className="text-xs text-text-secondary space-y-0.5 max-h-24 overflow-y-auto">
                  {parseErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            {/* Row preview table */}
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-bg-secondary">
                      <th className="text-left px-2 py-1.5 text-text-muted font-medium">Name</th>
                      <th className="text-left px-2 py-1.5 text-text-muted font-medium">Qty</th>
                      <th className="text-left px-2 py-1.5 text-text-muted font-medium">Set</th>
                      <th className="text-left px-2 py-1.5 text-text-muted font-medium">Binder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-2 py-1.5 text-text-primary truncate max-w-[120px]">{r.name}</td>
                        <td className="px-2 py-1.5 text-text-secondary tabular-nums">{r.quantity}</td>
                        <td className="px-2 py-1.5 text-text-secondary uppercase">{r.setCode || "—"}</td>
                        <td className="px-2 py-1.5 text-text-secondary truncate max-w-[80px]">{r.binder}</td>
                      </tr>
                    ))}
                    {rows.length > 8 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-1.5 text-text-muted italic text-center">
                          …and {rows.length - 8} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length === 0 && (
              <p className="text-sm text-text-muted italic text-center py-4">
                No valid rows found in the file.
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={rows.length === 0}
                className="px-4 py-2 rounded-xl btn-gradient text-sm font-bold transition-colors disabled:opacity-40"
              >
                Import {rows.length} card{rows.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 animate-spin text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-text-primary">
                Importing {progress.done} / {progress.total}…
              </p>
            </div>
            <div className="h-2 rounded-full bg-bg-card overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-legal/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-legal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Import complete</p>
                <p className="text-xs text-text-secondary">
                  {progress.total - progress.failed} added successfully
                  {progress.failed > 0 && `, ${progress.failed} failed`}
                </p>
              </div>
            </div>

            {importErrors.length > 0 && (
              <div className="bg-banned/10 border border-banned/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-banned mb-1">Errors ({importErrors.length})</p>
                <ul className="text-xs text-text-secondary space-y-0.5 max-h-32 overflow-y-auto">
                  {importErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl btn-gradient text-sm font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
