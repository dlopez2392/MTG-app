"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/ui/Toggle";
import { cn } from "@/lib/utils/cn";
import { useDecks } from "@/hooks/useDecks";
import { useCollection } from "@/hooks/useCollection";
import { identifyCard } from "@/lib/scan/identify";
import { loadHashIndex } from "@/lib/scan/dhash";
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

const AUTO_SCAN_INTERVAL = 2500;
const DEFAULT_SETTINGS: ScanSettings = {
  overrideSet: false,
  setCode: "",
  defaultFoil: false,
  autoAddQuantity: 1,
};

export default function ScanPageClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [indexReady, setIndexReady] = useState(false);

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

  const identifyFrame = useCallback(async () => {
    const video = videoRef.current;
    const hashCanvas = canvasRef.current;
    const ocrCanvas = ocrCanvasRef.current;
    if (!video || !hashCanvas || !ocrCanvas || scanningRef.current || video.videoWidth === 0) return;

    scanningRef.current = true;
    setScanning(true);
    setScanStatus(null);

    try {
      const result = await identifyCard(video, hashCanvas, ocrCanvas);

      if (result.card && result.confidence >= 0.3) {
        if (result.card.id !== lastScannedRef.current) {
          lastScannedRef.current = result.card.id;
          addToList(result.card);
          setScanStatus(`Found: ${result.card.name}`);
        } else {
          setScanStatus("Same card — move to next");
        }
      } else {
        setScanStatus(result.detail);
      }
    } catch (err) {
      setScanStatus(err instanceof Error ? err.message : "Scan failed");
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
      identifyFrame();
      autoScanTimerRef.current = setTimeout(tick, AUTO_SCAN_INTERVAL);
    };
    autoScanTimerRef.current = setTimeout(tick, 1500);
  }, [stopAutoScan, identifyFrame, paused]);

  const startCamera = useCallback(async (facing: CameraFacing = cameraFacing) => {
    stopCamera();
    setError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } });
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

  // Load hash index + auto-open camera on mount
  useEffect(() => {
    loadHashIndex().then(() => setIndexReady(true));
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // File upload uses the same identifyFrame flow via a temp image drawn to video canvas
    // For now, file upload is a secondary path — camera scanning is primary
    e.target.value = "";
  }, []);

  const manualCapture = useCallback(() => {
    identifyFrame();
  }, [identifyFrame]);

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
    <div className="flex flex-col h-[100dvh] pb-16 animate-page-enter">
      {/* Compact header bar */}
      {cameraActive && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <button
            onClick={clearList}
            disabled={scannedCards.length === 0}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>

          <span className="text-sm font-bold text-text-primary">{totalCards}</span>
          <span className="text-sm font-bold text-amber-400">${totalPrice.toFixed(2)}</span>

          <div className="flex-1" />

          <button
            onClick={() => { if (scannedCards.length > 0) setShowAddTo(true); }}
            disabled={scannedCards.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg-card text-xs font-medium text-text-primary disabled:opacity-30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add to...
          </button>

          <button
            onClick={togglePause}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90",
              paused ? "bg-emerald-500 shadow-emerald-500/30" : "bg-bg-card border border-border"
            )}
          >
            {paused ? (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg border border-border bg-bg-card text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      )}

      <div className="px-2 w-full flex-1 flex flex-col min-h-0">
        {/* Camera viewfinder */}
        {cameraActive && (
          <div className="relative rounded-2xl overflow-hidden border border-border bg-black flex-1 min-h-0 mt-2">
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
                <div className="bg-amber-500/80 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-xs text-white font-medium">Paused</span>
                </div>
              ) : scanning ? (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                  <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-emerald-400 font-medium">Scanning...</span>
                </div>
              ) : (
                <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-xs text-white/60">Point at a card</span>
                </div>
              )}
            </div>

            {/* Scan result feedback */}
            {scanStatus && !scanning && (
              <div className="absolute bottom-16 left-3 right-3 flex justify-center pointer-events-none">
                <div className={cn(
                  "rounded-full px-3 py-1 backdrop-blur-sm text-xs font-medium max-w-[90%] truncate",
                  scanStatus.startsWith("Found:") ? "bg-emerald-500/80 text-white" :
                  scanStatus.startsWith("Same card") ? "bg-white/20 text-white/60" :
                  "bg-red-500/60 text-white"
                )}>
                  {scanStatus}
                </div>
              </div>
            )}

            {/* Bottom controls */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4">
              <button onClick={stopCamera} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm text-white/80 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={manualCapture}
                disabled={scanning}
                className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
              >
                <div className="w-7 h-7 rounded-full bg-white" />
              </button>
              <button onClick={() => startCamera(cameraFacing === "environment" ? "user" : "environment")} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm text-white/80 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Scanned cards strip */}
        {cameraActive && scannedCards.length > 0 && (
          <div className="mt-2 -mx-2 px-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {scannedCards.map((sc) => {
                const img = sc.card.image_uris?.small ?? sc.card.image_uris?.normal ?? sc.card.card_faces?.[0]?.image_uris?.small;
                const price = sc.isFoil
                  ? sc.card.prices.usd_foil ?? sc.card.prices.usd
                  : sc.card.prices.usd;
                return (
                  <div key={sc.id} className="relative flex-shrink-0 w-14">
                    <button
                      onClick={() => removeCard(sc.id)}
                      className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {img && (
                      <Link href={`/search/${sc.card.id}`}>
                        <img src={img} alt={sc.card.name} className="w-full rounded shadow" />
                      </Link>
                    )}

                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-emerald-400">{price ? `$${price}` : "—"}</span>
                      <span className="text-[9px] font-bold text-text-muted">×{sc.quantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Camera loading state */}
        {!cameraActive && !error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted">
                {indexReady ? "Opening camera..." : "Loading card database..."}
              </span>
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
        <canvas ref={ocrCanvasRef} className="hidden" />
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
