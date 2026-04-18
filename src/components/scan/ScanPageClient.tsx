"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCameraScanner } from "@/hooks/useCameraScanner";
import { useCollection } from "@/hooks/useCollection";
import { useDecks } from "@/hooks/useDecks";
import Modal from "@/components/ui/Modal";
import type { ScryfallCard } from "@/types/card";
import type { ScanListItem } from "@/hooks/useCameraScanner";

// ── Compact scan-list item ────────────────────────────────────────────────────

function ScanItem({
  item,
  onQtyChange,
  onRemove,
  onToggleFoil,
  onViewDetails,
}: {
  item: ScanListItem;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
  onToggleFoil: () => void;
  onViewDetails: () => void;
}) {
  const imageUri =
    item.card.image_uris?.small ?? item.card.card_faces?.[0]?.image_uris?.small;
  const price = parseFloat(
    (item.isFoil ? item.card.prices?.usd_foil : item.card.prices?.usd) ??
      item.card.prices?.usd ?? "0"
  );

  return (
    <div className="flex items-center gap-2 bg-bg-card/90 backdrop-blur rounded-xl border border-border p-2">
      <button onClick={onViewDetails} className="flex-shrink-0">
        {imageUri ? (
          <img src={imageUri} alt={item.card.name} className="w-9 h-12 rounded object-cover" />
        ) : (
          <div className="w-9 h-12 rounded bg-bg-hover" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <button onClick={onViewDetails} className="text-left w-full">
          <p className="text-xs font-semibold text-text-primary truncate leading-tight">
            {item.card.name}
          </p>
          <p className="text-[10px] text-accent font-medium">
            ${(price * item.quantity).toFixed(2)}
            {item.quantity > 1 && (
              <span className="text-text-muted ml-1">(${price.toFixed(2)} ea)</span>
            )}
          </p>
        </button>

        {/* Foil toggle */}
        <button
          onClick={onToggleFoil}
          className={`mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
            item.isFoil
              ? "bg-accent/20 text-accent border border-accent/40"
              : "bg-bg-hover text-text-muted"
          }`}
        >
          ✦ FOIL
        </button>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onQtyChange(item.quantity - 1)}
          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
            item.quantity <= 1
              ? "bg-banned/20 text-banned"
              : "bg-bg-hover text-text-primary"
          }`}
        >
          {item.quantity <= 1 ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ) : "−"}
        </button>
        <span className="w-5 text-center text-xs font-semibold text-text-primary">{item.quantity}</span>
        <button
          onClick={() => onQtyChange(item.quantity + 1)}
          className="w-6 h-6 rounded bg-bg-hover text-text-primary flex items-center justify-center text-xs font-bold"
        >
          +
        </button>
      </div>

      <button onClick={onRemove} className="text-text-muted hover:text-banned transition-colors flex-shrink-0 p-1">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScanPageClient() {
  const router = useRouter();
  const {
    videoRef, canvasRef,
    isStreaming, isProcessing,
    statusText, suggestions, matchedCard, error, hasHashIndex,
    scanList, totalValue, addToScanList, removeFromScanList,
    updateScanListQty, toggleItemFoil, clearScanList,
    autoScan, setAutoScan,
    startCamera, stopCamera, captureAndRecognize, selectSuggestion, reset,
  } = useCameraScanner();

  const { allBinders, addCardToBinder } = useCollection();
  const { allDecks, addCardToDeck } = useDecks();

  const [cameraStarted, setCameraStarted] = useState(false);
  const [fileMode, setFileMode] = useState(false);
  const [showScanList, setShowScanList] = useState(false);
  const [showBinderPicker, setShowBinderPicker] = useState(false);
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [addTarget, setAddTarget] = useState<"collection" | "deck">("collection");
  const [addSuccess, setAddSuccess] = useState("");

  // Auto-dismiss matched card after 4s when auto-scan is on
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (matchedCard && autoScan) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        addToScanList(matchedCard);
        reset();
      }, 3000);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [matchedCard, autoScan, addToScanList, reset]);

  useEffect(() => {
    if (cameraStarted && !fileMode) startCamera();
  }, [cameraStarted, fileMode, startCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  function handleClose() {
    stopCamera();
    setCameraStarted(false);
    setFileMode(false);
    reset();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileMode(true);
    setCameraStarted(true);
    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Crop artwork region — mirrors hook's proportions
      const artX = Math.floor(img.width * 0.07);
      const artY = Math.floor(img.height * 0.14);
      const artW = Math.floor(img.width * 0.86);
      const artH = Math.floor(img.height * 0.43);
      canvas.width = artW;
      canvas.height = artH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, artX, artY, artW, artH, 0, 0, artW, artH);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

      try {
        const res = await fetch("/api/scan/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const result = await res.json() as {
          indexed: boolean;
          matches?: Array<{ id: string; name: string; setCode: string; distance: number }>;
        };
        if (result.indexed && result.matches && result.matches.length > 0) {
          const best = result.matches[0];
          const cardRes = await fetch(`/api/scryfall/cards/${best.id}`);
          if (cardRes.ok) {
            const card = await cardRes.json();
            addToScanList(card);
          }
        }
      } catch {
        // silently ignore — user can try camera
      }
    };
    img.src = URL.createObjectURL(file);
  }

  function handleAddMatchedToList(card: ScryfallCard) {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    addToScanList(card);
    reset();
  }

  async function handleBulkAdd(target: "collection" | "deck") {
    setAddTarget(target);
    const binders = allBinders;
    const decks = allDecks ?? [];
    if (target === "collection") {
      if (binders.length === 0) { alert("Create a binder first."); return; }
      if (binders.length === 1) { await doBulkAddToBinder(binders[0].id!); return; }
      setShowBinderPicker(true);
    } else {
      if (decks.length === 0) { alert("Create a deck first."); return; }
      if (decks.length === 1) { await doBulkAddToDeck(decks[0].id!); return; }
      setShowDeckPicker(true);
    }
  }

  async function doBulkAddToBinder(binderId: string) {
    for (const item of scanList) {
      const imageUri = item.card.image_uris?.small ?? item.card.card_faces?.[0]?.image_uris?.small;
      await addCardToBinder(binderId, {
        scryfallId: item.card.id,
        name: item.card.name,
        quantity: item.quantity,
        setCode: item.card.set,
        setName: item.card.set_name,
        collectorNumber: item.card.collector_number,
        imageUri,
        priceUsd: item.card.prices?.usd,
        typeLine: item.card.type_line,
        rarity: item.card.rarity,
        isFoil: item.isFoil,
      });
    }
    setShowBinderPicker(false);
    setShowScanList(false);
    clearScanList();
    setAddSuccess(`${scanList.length} card(s) added to collection!`);
    setTimeout(() => setAddSuccess(""), 3000);
  }

  async function doBulkAddToDeck(deckId: string) {
    for (const item of scanList) {
      await addCardToDeck(deckId, item.card, "main", item.quantity);
    }
    setShowDeckPicker(false);
    setShowScanList(false);
    clearScanList();
    setAddSuccess(`${scanList.length} card(s) added to deck!`);
    setTimeout(() => setAddSuccess(""), 3000);
  }

  // ── Intro screen ─────────────────────────────────────────────────────────

  if (!cameraStarted && !fileMode) {
    return (
      <div className="flex flex-col min-h-screen pb-20 bg-bg-primary">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-xl font-bold text-text-primary">Scan Card</h1>
          <p className="text-sm text-text-muted mt-1">Identify Magic cards using your camera</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="w-24 h-24 rounded-full bg-bg-card border border-border flex items-center justify-center">
            <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-text-secondary">
              Point your camera at a Magic card to identify it instantly.
            </p>
            <p className="text-xs text-text-muted">
              {hasHashIndex
                ? "Works best with good lighting — center the card artwork in the frame."
                : "Works best with good lighting and the card name clearly visible."}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => setCameraStarted(true)}
              className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm hover:bg-accent-dark transition-colors"
            >
              Open Camera
            </button>
            <label className="cursor-pointer w-full">
              <div className="w-full py-3 rounded-xl bg-bg-card border border-border text-text-secondary font-medium text-sm text-center hover:bg-bg-hover transition-colors">
                Upload Photo
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ── Immersive camera UI ──────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex: 55 }}>
      {/* Camera feed — fills screen */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Dark vignette edges */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)" }}
      />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-white font-medium">Scanning…</p>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)" }}
      >
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-white text-sm font-bold">Scan Cards</p>
          {scanList.length > 0 && (
            <p className="text-accent text-xs font-medium">
              {scanList.reduce((s, i) => s + i.quantity, 0)} cards · ${totalValue.toFixed(2)}
            </p>
          )}
        </div>

        {/* Scan list button */}
        <button
          onClick={() => setShowScanList(true)}
          className="relative w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {scanList.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
              {scanList.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Artwork guide box ── */}
      {!matchedCard && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-start"
          style={{ paddingTop: "14%" }}
        >
          <div
            className="border-2 rounded-xl"
            style={{
              width: "86%",
              height: "43%",
              borderColor: autoScan ? "#22c55e" : "#7C5CFC",
              boxShadow: `0 0 24px ${autoScan ? "rgba(34,197,94,0.35)" : "rgba(124,92,252,0.35)"}`,
            }}
          />
          <p className="mt-2 text-xs font-medium px-3 py-1 rounded-full bg-black/60"
            style={{ color: autoScan ? "#22c55e" : "#7C5CFC" }}
          >
            {autoScan ? "Auto-scanning…" : hasHashIndex ? "Center card artwork here" : "Align card name at top"}
          </p>
        </div>
      )}

      {/* ── Status text feedback ── */}
      {statusText && !matchedCard && !isProcessing && (
        <div className="absolute z-20 top-[60%] left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 rounded-lg whitespace-nowrap">
          <p className="text-xs text-white/80 font-medium">{statusText}</p>
        </div>
      )}

      {/* ── Error message ── */}
      {error && (
        <div className="absolute z-20 top-[38%] left-4 right-4 bg-banned/20 border border-banned/40 rounded-xl px-4 py-3">
          <p className="text-sm text-white text-center">{error}</p>
          <div className="flex gap-2 mt-2 justify-center">
            <button onClick={reset} className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors">
              Try Again
            </button>
            <button
              onClick={() => router.push("/search")}
              className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
            >
              Search Manually
            </button>
          </div>
        </div>
      )}

      {/* ── Suggestion picker ── */}
      {suggestions.length > 0 && !matchedCard && (
        <div className="absolute z-20 bottom-32 left-4 right-4 bg-bg-secondary/95 backdrop-blur rounded-xl border border-border p-3 space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs text-text-muted">Multiple matches — tap the correct card:</p>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSuggestion(s.id)}
              className="w-full flex items-center gap-3 px-3 py-2 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-left"
            >
              {s.imageUri
                ? <img src={s.imageUri} alt={s.name} className="w-8 h-11 rounded object-cover flex-shrink-0" />
                : <div className="w-8 h-11 rounded bg-bg-hover flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{s.name}</p>
                {s.setName && <p className="text-xs text-text-muted truncate">{s.setName}</p>}
                {s.prices?.usd && <p className="text-xs text-accent">${s.prices.usd}</p>}
              </div>
            </button>
          ))}
          <button onClick={reset} className="w-full py-2 text-xs text-text-muted hover:text-text-primary transition-colors">
            None of these — try again
          </button>
        </div>
      )}

      {/* ── Matched card result panel ── */}
      {matchedCard && (
        <div className="absolute z-20 bottom-32 left-4 right-4 bg-bg-secondary/95 backdrop-blur rounded-xl border border-border p-3">
          <div className="flex gap-3 items-start">
            {(matchedCard.image_uris?.small ?? matchedCard.card_faces?.[0]?.image_uris?.small) && (
              <button onClick={() => { stopCamera(); router.push(`/search/${matchedCard.id}`); }}>
                <img
                  src={matchedCard.image_uris?.small ?? matchedCard.card_faces?.[0]?.image_uris?.small}
                  alt={matchedCard.name}
                  className="w-14 rounded-lg shadow-lg flex-shrink-0"
                />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => { stopCamera(); router.push(`/search/${matchedCard.id}`); }}
                className="text-left w-full"
              >
                <p className="font-bold text-text-primary leading-tight">{matchedCard.name}</p>
                <p className="text-xs text-text-muted mt-0.5">{matchedCard.set_name}</p>
                {matchedCard.prices?.usd && (
                  <p className="text-sm font-semibold text-accent mt-1">${matchedCard.prices.usd}</p>
                )}
              </button>
              <p className="text-[10px] text-text-muted mt-1">Tap name/art to view details</p>
            </div>
            <button
              onClick={reset}
              className="w-7 h-7 rounded-full bg-bg-hover flex items-center justify-center text-text-muted hover:text-text-primary flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleAddMatchedToList(matchedCard)}
              className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-dark transition-colors"
            >
              + Add to List
            </button>
            <button
              onClick={() => { handleAddMatchedToList(matchedCard); handleBulkAdd("collection"); }}
              className="flex-1 py-2 rounded-lg bg-bg-hover text-text-primary text-xs font-medium hover:bg-bg-card transition-colors border border-border"
            >
              + Collection
            </button>
            <button
              onClick={() => { handleAddMatchedToList(matchedCard); handleBulkAdd("deck"); }}
              className="flex-1 py-2 rounded-lg bg-bg-hover text-text-primary text-xs font-medium hover:bg-bg-card transition-colors border border-border"
            >
              + Deck
            </button>
          </div>

          {autoScan && (
            <p className="text-center text-[10px] text-text-muted mt-2">Auto-adding in 3s…</p>
          )}
        </div>
      )}

      {/* ── Success toast ── */}
      {addSuccess && (
        <div className="absolute z-30 top-28 left-4 right-4 bg-legal/20 border border-legal/40 rounded-xl px-4 py-3">
          <p className="text-sm text-legal text-center font-medium">{addSuccess}</p>
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-24 pt-6 px-8"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
      >
        {/* Recent scans preview (last 4) */}
        {scanList.length > 0 && (
          <button
            onClick={() => setShowScanList(true)}
            className="flex items-center gap-1.5 mb-5"
          >
            {scanList.slice(0, 4).map((item) => {
              const uri = item.card.image_uris?.small ?? item.card.card_faces?.[0]?.image_uris?.small;
              return uri ? (
                <img key={item.listId} src={uri} alt={item.card.name}
                  className="w-8 h-11 rounded object-cover border border-white/30 shadow"
                />
              ) : null;
            })}
            {scanList.length > 4 && (
              <div className="w-8 h-11 rounded bg-bg-card/80 border border-white/30 flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">+{scanList.length - 4}</span>
              </div>
            )}
          </button>
        )}

        <div className="flex items-center gap-8">
          {/* Auto-scan toggle */}
          <button
            onClick={() => setAutoScan(!autoScan)}
            className={`flex flex-col items-center gap-1 transition-colors ${
              autoScan ? "text-legal" : "text-white/60 hover:text-white"
            }`}
          >
            <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${
              autoScan ? "border-legal bg-legal/20" : "border-white/40 bg-black/40"
            }`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <span className="text-[9px] font-medium">{autoScan ? "AUTO ON" : "AUTO"}</span>
          </button>

          {/* Capture button */}
          {!fileMode && (
            <button
              onClick={captureAndRecognize}
              disabled={isProcessing}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
              aria-label="Scan card"
            >
              <div className="w-13 h-13 rounded-full border-2 border-bg-primary flex items-center justify-center">
                <svg className="w-7 h-7 text-bg-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
            </button>
          )}

          {/* Add all to... */}
          <button
            onClick={() => setShowScanList(true)}
            disabled={scanList.length === 0}
            className={`flex flex-col items-center gap-1 transition-colors ${
              scanList.length > 0 ? "text-accent hover:text-accent-light" : "text-white/30"
            }`}
          >
            <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${
              scanList.length > 0 ? "border-accent bg-accent/20" : "border-white/20 bg-black/40"
            }`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-[9px] font-medium">ADD ALL</span>
          </button>
        </div>
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Scan list modal ── */}
      <Modal open={showScanList} onClose={() => setShowScanList(false)} title={`Scan List (${scanList.reduce((s, i) => s + i.quantity, 0)} cards · $${totalValue.toFixed(2)})`}>
        {scanList.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No cards scanned yet.</p>
        ) : (
          <>
            <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
              {scanList.map((item) => (
                <ScanItem
                  key={item.listId}
                  item={item}
                  onQtyChange={(qty) => updateScanListQty(item.listId, qty)}
                  onRemove={() => removeFromScanList(item.listId)}
                  onToggleFoil={() => toggleItemFoil(item.listId)}
                  onViewDetails={() => { setShowScanList(false); stopCamera(); router.push(`/search/${item.card.id}`); }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAdd("collection")}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-dark transition-colors"
              >
                Add to Collection
              </button>
              <button
                onClick={() => handleBulkAdd("deck")}
                className="flex-1 py-2.5 rounded-xl bg-bg-hover border border-border text-text-primary text-sm font-medium hover:bg-bg-card transition-colors"
              >
                Add to Deck
              </button>
            </div>
            <button
              onClick={() => { clearScanList(); setShowScanList(false); }}
              className="w-full mt-2 py-2 text-sm text-banned hover:text-banned/80 transition-colors"
            >
              Clear List
            </button>
          </>
        )}
      </Modal>

      {/* ── Binder picker ── */}
      <Modal open={showBinderPicker} onClose={() => setShowBinderPicker(false)} title="Choose Binder">
        <div className="space-y-2">
          {allBinders.map((b) => (
            <button
              key={b.id}
              onClick={() => doBulkAddToBinder(b.id!)}
              className="w-full text-left px-4 py-3 rounded-lg bg-bg-hover hover:bg-bg-card transition-colors text-sm text-text-primary border border-border"
            >
              {b.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Deck picker ── */}
      <Modal open={showDeckPicker} onClose={() => setShowDeckPicker(false)} title="Choose Deck">
        <div className="space-y-2">
          {(allDecks ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() => doBulkAddToDeck(d.id!)}
              className="w-full text-left px-4 py-3 rounded-lg bg-bg-hover hover:bg-bg-card transition-colors text-sm text-text-primary border border-border"
            >
              {d.name}
              {d.format && <span className="text-xs text-text-muted ml-2 capitalize">{d.format}</span>}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
