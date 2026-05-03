"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import HeroBanner from "@/components/layout/HeroBanner";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/ui/Toggle";
import { cn } from "@/lib/utils/cn";
import { useDecks } from "@/hooks/useDecks";
import { useCollection } from "@/hooks/useCollection";
import type { ScryfallCard } from "@/types/card";

type CameraFacing = "environment" | "user";

interface ScannedCard {
  id: string;
  card: ScryfallCard;
  quantity: number;
  isFoil: boolean;
}

interface ScanSettings {
  overrideSet: boolean;
  setCode: string;
  defaultFoil: boolean;
  autoAddQuantity: number;
}

interface ApiScanResult {
  identified: boolean;
  confidence: number;
  reasoning: string;
  card?: ScryfallCard | null;
  cardName?: string;
  setCode?: string;
  error?: string;
}

const AUTO_SCAN_INTERVAL = 2500;
const DEFAULT_SETTINGS: ScanSettings = {
  overrideSet: false,
  setCode: "",
  defaultFoil: false,
  autoAddQuantity: 1,
};

const SCAN_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);

export default function ScanPageClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedRef = useRef<string>("");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");
  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scannedCards, setScannedCards] = useState<ScannedCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTo, setShowAddTo] = useState(false);
  const [settings, setSettings] = useState<ScanSettings>(DEFAULT_SETTINGS);
  const [addStatus, setAddStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Hooks for Add to...
  const { allDecks, addCardToDeck } = useDecks();
  const { allBinders, addCardToBinder } = useCollection();

  // Computed
  const totalCards = scannedCards.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = scannedCards.reduce((sum, c) => {
    const price = c.isFoil
      ? parseFloat(c.card.prices.usd_foil ?? c.card.prices.usd ?? "0")
      : parseFloat(c.card.prices.usd ?? "0");
    return sum + price * c.quantity;
  }, 0);

  // ── Camera ──

  const stopAutoScan = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopAutoScan();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, [stopAutoScan]);

  const attachStream = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.srcObject = stream;
    video.onloadedmetadata = () => { video.play().catch(() => {}); };
  }, []);

  const grabFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;
    const maxDim = 1024;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const addToList = useCallback((card: ScryfallCard) => {
    setScannedCards((prev) => {
      const existing = prev.find((c) => c.card.id === card.id);
      if (existing) {
        return prev.map((c) =>
          c.card.id === card.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
        card,
        quantity: settings.autoAddQuantity,
        isFoil: settings.defaultFoil,
      }];
    });
  }, [settings.autoAddQuantity, settings.defaultFoil]);

  const identifyImage = useCallback(async (imageDataUrl: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);

    try {
      const res = await fetch("/api/scan/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      const data: ApiScanResult = await res.json();

      if (data.identified && data.card && data.confidence >= 0.6) {
        if (data.card.id !== lastScannedRef.current) {
          lastScannedRef.current = data.card.id;
          addToList(data.card);
        }
      }
    } catch {
      // Silent fail for auto-scan — don't interrupt
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [addToList]);

  const startAutoScan = useCallback(() => {
    stopAutoScan();
    const tick = () => {
      if (!streamRef.current || scanningRef.current || paused) {
        autoScanTimerRef.current = setTimeout(tick, AUTO_SCAN_INTERVAL);
        return;
      }
      const frame = grabFrame();
      if (frame) identifyImage(frame);
      autoScanTimerRef.current = setTimeout(tick, AUTO_SCAN_INTERVAL);
    };
    autoScanTimerRef.current = setTimeout(tick, 1500);
  }, [stopAutoScan, grabFrame, identifyImage, paused]);

  const startCamera = useCallback(async (facing: CameraFacing = cameraFacing) => {
    stopCamera();
    setError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 720 }, height: { ideal: 1280 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 720 }, height: { ideal: 1280 } } });
      }
      streamRef.current = stream;
      setCameraActive(true);
      setCameraFacing(facing);
      setPaused(false);
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, [cameraFacing, stopCamera]);

  useEffect(() => {
    if (cameraActive && streamRef.current) {
      attachStream(streamRef.current);
      startAutoScan();
    }
  }, [cameraActive, attachStream, startAutoScan]);

  useEffect(() => {
    return () => {
      stopAutoScan();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [stopAutoScan]);

  // ── Handlers ──

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxDim = 1024;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      identifyImage(canvas.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  }, [identifyImage]);

  const manualCapture = useCallback(() => {
    const frame = grabFrame();
    if (frame) identifyImage(frame);
  }, [grabFrame, identifyImage]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const removeCard = useCallback((id: string) => {
    setScannedCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setScannedCards((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const newQty = Math.max(1, c.quantity + delta);
      return { ...c, quantity: newQty };
    }));
  }, []);

  const toggleFoil = useCallback((id: string) => {
    setScannedCards((prev) => prev.map((c) =>
      c.id === id ? { ...c, isFoil: !c.isFoil } : c
    ));
  }, []);

  const clearList = useCallback(() => {
    setScannedCards([]);
    lastScannedRef.current = "";
  }, []);

  const addAllToBinder = useCallback(async (binderId: string) => {
    try {
      for (const sc of scannedCards) {
        const imageUri = sc.card.image_uris?.normal ?? sc.card.card_faces?.[0]?.image_uris?.normal;
        await addCardToBinder(binderId, {
          scryfallId: sc.card.id,
          name: sc.card.name,
          quantity: sc.quantity,
          isFoil: sc.isFoil,
          setCode: sc.card.set,
          setName: sc.card.set_name,
          collectorNumber: sc.card.collector_number,
          imageUri,
          priceUsd: sc.isFoil ? sc.card.prices.usd_foil : sc.card.prices.usd,
          typeLine: sc.card.type_line,
          rarity: sc.card.rarity,
        });
      }
      setAddStatus({ type: "success", message: `Added ${totalCards} card${totalCards !== 1 ? "s" : ""} to binder` });
      setTimeout(() => { setShowAddTo(false); setAddStatus(null); clearList(); }, 1500);
    } catch {
      setAddStatus({ type: "error", message: "Failed to add cards" });
    }
  }, [scannedCards, totalCards, addCardToBinder, clearList]);

  const addAllToDeck = useCallback(async (deckId: string) => {
    try {
      for (const sc of scannedCards) {
        await addCardToDeck(deckId, sc.card, "main", sc.quantity);
      }
      setAddStatus({ type: "success", message: `Added ${totalCards} card${totalCards !== 1 ? "s" : ""} to deck` });
      setTimeout(() => { setShowAddTo(false); setAddStatus(null); clearList(); }, 1500);
    } catch {
      setAddStatus({ type: "error", message: "Failed to add cards" });
    }
  }, [scannedCards, totalCards, addCardToDeck, clearList]);

  return (
    <div className="flex flex-col min-h-screen pb-20 animate-page-enter">
      {/* Header */}
      {cameraActive ? (
        <div className="px-4 pt-4 pb-2 space-y-2">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-text-primary">Scan List</h1>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-text-primary">{totalCards}</span>
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-6A2.25 2.25 0 019.75 18v-2.25m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
              </svg>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={clearList}
                disabled={scannedCards.length === 0}
                className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>

            <span className="text-lg font-bold text-amber-400">${totalPrice.toFixed(2)}</span>
          </div>

          {/* Control bar */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { if (scannedCards.length > 0) setShowAddTo(true); }}
              disabled={scannedCards.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-bg-card text-sm font-medium text-text-primary disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add to...
            </button>

            <button
              onClick={togglePause}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90",
                paused ? "bg-emerald-500 shadow-emerald-500/30" : "bg-bg-card border-2 border-border"
              )}
            >
              {paused ? (
                <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-bg-card text-sm font-medium text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>
        </div>
      ) : (
        <HeroBanner title="SCANNER" subtitle="AI-powered card scanning" accent="#10B981" icon={SCAN_ICON} />
      )}

      <div className="px-4 max-w-2xl mx-auto w-full flex-1 flex flex-col">
        {/* Camera viewfinder */}
        {cameraActive && (
          <div className="relative rounded-2xl overflow-hidden border border-border bg-black flex-1 min-h-0">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "translateZ(0)" }}
            />

            {/* Scan guide */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[12%] border-2 border-white/25 rounded-xl" />
              <div className="absolute top-[12%] left-[12%] w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-[12%] right-[12%] w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-[12%] left-[12%] w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-[12%] right-[12%] w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
            </div>

            {/* Status indicator */}
            <div className="absolute top-3 left-0 right-0 flex justify-center">
              {paused ? (
                <div className="bg-amber-500/80 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="text-xs text-white font-medium">Paused</span>
                </div>
              ) : scanning ? (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-emerald-400 font-medium">Scanning...</span>
                </div>
              ) : (
                <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="text-xs text-white/60">Point at a card</span>
                </div>
              )}
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4">
              <button onClick={stopCamera} className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-white/80 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={manualCapture}
                disabled={scanning}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-full bg-white" />
              </button>
              <button onClick={() => startCamera(cameraFacing === "environment" ? "user" : "environment")} className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-white/80 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Scanned cards strip */}
        {cameraActive && scannedCards.length > 0 && (
          <div className="mt-3 -mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {scannedCards.map((sc) => {
                const img = sc.card.image_uris?.normal ?? sc.card.card_faces?.[0]?.image_uris?.normal;
                const price = sc.isFoil
                  ? sc.card.prices.usd_foil ?? sc.card.prices.usd
                  : sc.card.prices.usd;
                return (
                  <div key={sc.id} className="relative flex-shrink-0 w-32">
                    {/* Remove button */}
                    <button
                      onClick={() => removeCard(sc.id)}
                      className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Card image */}
                    {img && (
                      <Link href={`/search/${sc.card.id}`}>
                        <img src={img} alt={sc.card.name} className="w-full rounded-lg shadow-md" />
                      </Link>
                    )}

                    {/* Price + set overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent rounded-b-lg p-1.5 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-400">{price ? `$${price}` : "—"}</span>
                        <span className="text-[9px] text-white/60 uppercase">#{sc.card.collector_number}</span>
                      </div>
                    </div>

                    {/* Controls below card */}
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <button
                        onClick={() => toggleFoil(sc.id)}
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors",
                          sc.isFoil ? "bg-purple-500/20 text-purple-300" : "bg-bg-hover text-text-muted"
                        )}
                      >
                        {sc.isFoil ? "FOIL" : "REG"}
                      </button>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => updateQuantity(sc.id, -1)}
                          className="w-5 h-5 rounded bg-bg-hover text-text-muted flex items-center justify-center text-xs font-bold"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold text-text-primary w-4 text-center">{sc.quantity}</span>
                        <button
                          onClick={() => updateQuantity(sc.id, 1)}
                          className="w-5 h-5 rounded bg-accent/20 text-accent flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Start screen */}
        {!cameraActive && (
          <div className="space-y-3">
            <button
              onClick={() => startCamera()}
              className="w-full glass-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-emerald-500/40 transition-colors active:scale-[0.98]"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-text-primary">Open Camera</p>
                <p className="text-xs text-text-muted mt-0.5">Auto-scans cards as you point</p>
              </div>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full glass-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-accent/40 transition-colors active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">Upload Photo</p>
                <p className="text-xs text-text-muted">Select an image from your device</p>
              </div>
            </button>

            <div className="glass-card border border-border rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-text-primary">Tips for best results</p>
              <ul className="text-xs text-text-muted space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#9679;</span>Good lighting — avoid glare on foil cards</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#9679;</span>Keep the card flat and fill the frame</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#9679;</span>Hold steady — auto-scan runs continuously</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#9679;</span>Works with any language or edition</li>
              </ul>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card border border-red-500/20 rounded-2xl p-4 bg-red-500/5 mt-4">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => { setError(null); startCamera(); }} className="mt-2 text-sm text-accent underline">Try Again</button>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
      </div>

      {/* ── Settings Modal ── */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Scan Settings">
        <div className="space-y-1">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Default Foil</p>
              <p className="text-xs text-text-muted">Mark scanned cards as foil by default</p>
            </div>
            <Toggle value={settings.defaultFoil} onChange={(v) => setSettings((s) => ({ ...s, defaultFoil: v }))} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Override Set</p>
              <p className="text-xs text-text-muted">Force a specific set code for all scans</p>
            </div>
            <Toggle value={settings.overrideSet} onChange={(v) => setSettings((s) => ({ ...s, overrideSet: v }))} />
          </div>

          {settings.overrideSet && (
            <input
              type="text"
              placeholder="Set code (e.g. MH3)"
              value={settings.setCode}
              onChange={(e) => setSettings((s) => ({ ...s, setCode: e.target.value.toLowerCase() }))}
              className="w-full input-base mb-2"
            />
          )}

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Auto-add Quantity</p>
              <p className="text-xs text-text-muted">Default quantity when a card is scanned</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, autoAddQuantity: Math.max(1, s.autoAddQuantity - 1) }))}
                className="w-7 h-7 rounded-lg bg-bg-hover text-text-muted flex items-center justify-center text-sm font-bold"
              >−</button>
              <span className="text-sm font-bold text-text-primary w-4 text-center">{settings.autoAddQuantity}</span>
              <button
                onClick={() => setSettings((s) => ({ ...s, autoAddQuantity: Math.min(99, s.autoAddQuantity + 1) }))}
                className="w-7 h-7 rounded-lg bg-accent/20 text-accent flex items-center justify-center text-sm font-bold"
              >+</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Add to... Modal ── */}
      <Modal open={showAddTo} onClose={() => { setShowAddTo(false); setAddStatus(null); }} title="Add to...">
        {addStatus ? (
          <div className={cn(
            "rounded-xl px-4 py-3 text-sm font-medium",
            addStatus.type === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          )}>
            {addStatus.message}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">{totalCards} card{totalCards !== 1 ? "s" : ""} &middot; ${totalPrice.toFixed(2)}</p>

            {/* Binders */}
            {allBinders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Collection Binders</p>
                <div className="space-y-1">
                  {allBinders.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => addAllToBinder(b.id!)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-hover border border-border text-left hover:border-accent/30 transition-colors"
                    >
                      <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span className="text-sm text-text-primary">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Decks */}
            {allDecks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Decks</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {allDecks.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => addAllToDeck(d.id!)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-hover border border-border text-left hover:border-accent/30 transition-colors"
                    >
                      <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <div className="min-w-0">
                        <span className="text-sm text-text-primary truncate block">{d.name}</span>
                        {d.format && <span className="text-[10px] text-text-muted capitalize">{d.format}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allBinders.length === 0 && allDecks.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">No binders or decks yet. Create one first.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
