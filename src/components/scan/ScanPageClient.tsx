"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCameraScanner } from "@/hooks/useCameraScanner";
import { useCollection } from "@/hooks/useCollection";
import { useDecks } from "@/hooks/useDecks";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { ScryfallCard } from "@/types/card";

function CardResult({
  card,
  onViewDetails,
  onAddToCollection,
  onAddToDeck,
  onScanAgain,
}: {
  card: ScryfallCard;
  onViewDetails: () => void;
  onAddToCollection: () => void;
  onAddToDeck: () => void;
  onScanAgain: () => void;
}) {
  const imageUri =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
  const price = card.prices?.usd
    ? `$${card.prices.usd}`
    : card.prices?.eur
      ? `€${card.prices.eur}`
      : null;

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex gap-4">
        {imageUri && (
          <img
            src={imageUri}
            alt={card.name}
            className="w-28 rounded-lg shadow-lg"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-text-primary">{card.name}</h3>
          <p className="text-sm text-text-muted mt-0.5">{card.set_name}</p>
          <p className="text-xs text-text-muted mt-0.5">{card.type_line}</p>
          {price && (
            <p className="text-sm font-semibold text-accent mt-2">{price}</p>
          )}
          {card.rarity && (
            <span className="inline-block mt-1 text-xs capitalize text-text-secondary">
              {card.rarity}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={onViewDetails}>
          View Details
        </Button>
        <Button size="sm" variant="secondary" onClick={onScanAgain}>
          Scan Again
        </Button>
        <Button size="sm" variant="secondary" onClick={onAddToCollection}>
          + Collection
        </Button>
        <Button size="sm" variant="secondary" onClick={onAddToDeck}>
          + Deck
        </Button>
      </div>
    </div>
  );
}

export default function ScanPageClient() {
  const router = useRouter();
  const {
    videoRef,
    canvasRef,
    isStreaming,
    isProcessing,
    ocrText,
    matchedCard,
    error,
    startCamera,
    stopCamera,
    captureAndRecognize,
    reset,
  } = useCameraScanner();

  const { allBinders, addCardToBinder } = useCollection();
  const { allDecks, addCardToDeck } = useDecks();

  const [showBinderPicker, setShowBinderPicker] = useState(false);
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [fileMode, setFileMode] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);

  // Start camera AFTER the video element is in the DOM
  useEffect(() => {
    if (cameraStarted && !fileMode) {
      startCamera();
    }
  }, [cameraStarted, fileMode, startCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function handleStartCamera() {
    setCameraStarted(true);
    // startCamera() fires via the effect above, after video element renders
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileMode(true);
    // Draw the uploaded image onto a virtual video-like canvas, then trigger OCR
    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Crop title bar region from the image
      const cropY = Math.floor(img.height * 0.05);
      const cropH = Math.floor(img.height * 0.13);
      const cropX = Math.floor(img.width * 0.05);
      const cropW = Math.floor(img.width * 0.75);

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Import and preprocess
      const { preprocessImageData } = await import(
        "@/lib/ocr/cardNameExtractor"
      );
      preprocessImageData(ctx, cropW, cropH);

      // Use the same recognition flow
      await captureAndRecognize();
    };
    img.src = URL.createObjectURL(file);
  }

  async function handleAddToCollection(card: ScryfallCard) {
    if (allBinders.length === 0) {
      alert("Create a binder first in your Collection.");
      return;
    }
    if (allBinders.length === 1) {
      await doAddToBinder(allBinders[0].id!, card);
      return;
    }
    setShowBinderPicker(true);
  }

  async function doAddToBinder(binderId: string, card: ScryfallCard) {
    const imageUri =
      card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small;
    await addCardToBinder(binderId, {
      scryfallId: card.id,
      name: card.name,
      quantity: 1,
      setCode: card.set,
      setName: card.set_name,
      collectorNumber: card.collector_number,
      imageUri,
      priceUsd: card.prices?.usd,
      typeLine: card.type_line,
      rarity: card.rarity,
    });
    setShowBinderPicker(false);
    alert(`Added ${card.name} to binder!`);
  }

  async function handleAddToDeck(card: ScryfallCard) {
    const decks = allDecks ?? [];
    if (decks.length === 0) {
      alert("Create a deck first.");
      return;
    }
    if (decks.length === 1) {
      await doAddToDeck(decks[0].id!, card);
      return;
    }
    setShowDeckPicker(true);
  }

  async function doAddToDeck(deckId: string, card: ScryfallCard) {
    await addCardToDeck(deckId, card as Partial<ScryfallCard>);
    setShowDeckPicker(false);
    alert(`Added ${card.name} to deck!`);
  }

  // Initial state — not started yet
  if (!cameraStarted && !fileMode) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-xl font-bold text-text-primary">Scan Card</h1>
          <p className="text-sm text-text-muted mt-1">
            Use your camera to identify Magic cards
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="w-24 h-24 rounded-full bg-bg-card border border-border flex items-center justify-center">
            <svg
              className="w-12 h-12 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-text-secondary">
              Point your camera at a Magic card and tap scan to identify it.
            </p>
            <p className="text-xs text-text-muted">
              Works best with good lighting and the card name clearly visible.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button onClick={handleStartCamera} className="w-full">
              Open Camera
            </Button>

            <label className="cursor-pointer">
              <Button
                variant="secondary"
                className="w-full pointer-events-none"
              >
                Upload Photo
              </Button>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Scan Card</h1>
        <button
          onClick={() => {
            stopCamera();
            setCameraStarted(false);
            setFileMode(false);
            reset();
          }}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Close
        </button>
      </div>

      {/* Camera viewfinder — video element always in DOM once camera started so ref is available */}
      {!matchedCard && (
        <div className="relative mx-4 rounded-xl overflow-hidden bg-black aspect-[3/4]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Guide overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Darken edges */}
            <div className="absolute inset-0 border-[3px] border-accent/40 rounded-xl" />

            {/* Title bar highlight zone */}
            <div
              className="absolute left-[5%] right-[20%] border-2 border-accent rounded"
              style={{ top: "5%", height: "13%" }}
            >
              <div className="absolute -top-6 left-0 text-[10px] text-accent font-medium bg-black/60 px-2 py-0.5 rounded">
                Align card name here
              </div>
            </div>

            {/* Card outline guide */}
            <div
              className="absolute border border-white/20 rounded-lg"
              style={{
                top: "2%",
                left: "3%",
                right: "3%",
                bottom: "2%",
              }}
            />
          </div>

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white">Scanning card...</p>
            </div>
          )}
        </div>
      )}

      {/* Capture button */}
      {isStreaming && !matchedCard && !isProcessing && !fileMode && (
        <div className="flex justify-center mt-6">
          <button
            onClick={captureAndRecognize}
            className="w-16 h-16 rounded-full bg-accent hover:bg-accent-dark transition-colors flex items-center justify-center shadow-lg"
            aria-label="Scan card"
          >
            <svg
              className="w-8 h-8 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
          </button>
        </div>
      )}

      {/* OCR text feedback */}
      {ocrText && !matchedCard && (
        <div className="mx-4 mt-3 px-3 py-2 bg-bg-card rounded-lg border border-border">
          <p className="text-xs text-text-muted">
            Read: <span className="text-text-primary font-medium">{ocrText}</span>
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                reset();
              }}
            >
              Try Again
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/search?q=${encodeURIComponent(ocrText)}`)}
            >
              Search Manually
            </Button>
          </div>
        </div>
      )}

      {/* Match result */}
      {matchedCard && (
        <div className="px-4 mt-4">
          <p className="text-xs text-text-muted mb-2">
            {ocrText && (
              <>
                Read: &quot;{ocrText}&quot; &mdash;{" "}
              </>
            )}
            Match found!
          </p>
          <CardResult
            card={matchedCard}
            onViewDetails={() => {
              stopCamera();
              router.push(`/search/${matchedCard.id}`);
            }}
            onAddToCollection={() => handleAddToCollection(matchedCard)}
            onAddToDeck={() => handleAddToDeck(matchedCard)}
            onScanAgain={() => reset()}
          />
        </div>
      )}

      {/* Hidden canvas for OCR processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Binder picker modal */}
      <Modal
        open={showBinderPicker}
        onClose={() => setShowBinderPicker(false)}
        title="Choose Binder"
      >
        <div className="space-y-2">
          {allBinders.map((b) => (
            <button
              key={b.id}
              onClick={() =>
                matchedCard && doAddToBinder(b.id!, matchedCard)
              }
              className="w-full text-left px-4 py-3 rounded-lg bg-bg-hover hover:bg-border transition-colors text-sm text-text-primary"
            >
              {b.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Deck picker modal */}
      <Modal
        open={showDeckPicker}
        onClose={() => setShowDeckPicker(false)}
        title="Choose Deck"
      >
        <div className="space-y-2">
          {(allDecks ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() =>
                matchedCard && doAddToDeck(d.id!, matchedCard)
              }
              className="w-full text-left px-4 py-3 rounded-lg bg-bg-hover hover:bg-border transition-colors text-sm text-text-primary"
            >
              {d.name}
              {d.format && (
                <span className="text-xs text-text-muted ml-2 capitalize">
                  {d.format}
                </span>
              )}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
