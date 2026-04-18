"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ScryfallCard } from "@/types/card";

export interface CardScanSuggestion {
  id: string;
  name: string;
  imageUri: string | null;
  setName: string | null;
  prices: { usd?: string | null };
}

export interface ScanListItem {
  listId: string;
  card: ScryfallCard;
  quantity: number;
  isFoil: boolean;
}

interface UseCameraScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isStreaming: boolean;
  isProcessing: boolean;
  statusText: string;
  suggestions: CardScanSuggestion[];
  matchedCard: ScryfallCard | null;
  error: string;
  hasHashIndex: boolean;
  // Scan list
  scanList: ScanListItem[];
  totalValue: number;
  addToScanList: (card: ScryfallCard) => void;
  removeFromScanList: (listId: string) => void;
  updateScanListQty: (listId: string, qty: number) => void;
  toggleItemFoil: (listId: string) => void;
  clearScanList: () => void;
  // Auto-scan
  autoScan: boolean;
  setAutoScan: (v: boolean) => void;
  // Actions
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureAndRecognize: () => Promise<void>;
  selectSuggestion: (id: string) => Promise<void>;
  reset: () => void;
}

let listIdCounter = 0;

// ── Browser-side dHash ────────────────────────────────────────────────────────
// Mirrors the server-side algorithm in src/lib/scan/dhash.ts

function computeDHashFromCanvas(
  source: HTMLVideoElement | HTMLCanvasElement,
  cropX: number, cropY: number, cropW: number, cropH: number
): string {
  const tmp = document.createElement("canvas");
  tmp.width = 9;
  tmp.height = 8;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, 9, 8);
  const { data } = ctx.getImageData(0, 0, 9, 8);

  let lo = 0, hi = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i1 = (y * 9 + x) * 4;
      const i2 = (y * 9 + x + 1) * 4;
      const g1 = data[i1] * 0.299 + data[i1 + 1] * 0.587 + data[i1 + 2] * 0.114;
      const g2 = data[i2] * 0.299 + data[i2 + 1] * 0.587 + data[i2 + 2] * 0.114;
      const bit = y * 8 + x;
      if (g1 > g2) {
        if (bit < 32) lo |= 1 << bit;
        else hi |= 1 << (bit - 32);
      }
    }
  }
  return (hi >>> 0).toString(16).padStart(8, "0") +
         (lo >>> 0).toString(16).padStart(8, "0");
}

// Crop a JPEG from the video at the artwork region and return as base64 data URL
function cropArtworkToDataUrl(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  artX: number, artY: number, artW: number, artH: number
): string {
  canvas.width = artW;
  canvas.height = artH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, artX, artY, artW, artH, 0, 0, artW, artH);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// ── OCR fallback (Tesseract) ──────────────────────────────────────────────────

function cleanOcrText(raw: string): string {
  let text = raw.trim()
    .replace(/[|]/g, "l")
    .replace(/1(?=[a-z])/gi, "l")
    .replace(/0(?=[a-z])/gi, "o")
    .replace(/\{[^}]*\}/g, "")
    .replace(/[^a-zA-Z0-9\s\-',.\/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/\s*\/\s*/g, " // ").replace(/\/\/ \/\//g, "//");
  return text.length < 2 ? "" : text;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCameraScanner(): UseCameraScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<import("tesseract.js").Worker | null>(null);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatchedNameRef = useRef<string>("");
  const isProcessingRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [suggestions, setSuggestions] = useState<CardScanSuggestion[]>([]);
  const [matchedCard, setMatchedCard] = useState<ScryfallCard | null>(null);
  const [error, setError] = useState("");
  const [scanList, setScanList] = useState<ScanListItem[]>([]);
  const [autoScan, setAutoScan] = useState(false);
  const [hasHashIndex, setHasHashIndex] = useState(false);

  // Check if hash index exists on mount
  useEffect(() => {
    fetch("/api/scan/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/jpeg;base64,/9j/4AAQ" }), // tiny probe
    })
      .then(r => r.json())
      .then(d => setHasHashIndex(d.indexed === true))
      .catch(() => setHasHashIndex(false));
  }, []);

  const totalValue = scanList.reduce((sum, item) => {
    const price = parseFloat(
      (item.isFoil ? item.card.prices?.usd_foil : item.card.prices?.usd) ?? item.card.prices?.usd ?? "0"
    );
    return sum + price * item.quantity;
  }, 0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      workerRef.current?.terminate();
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
      });

      // Apply advanced constraints (autofocus, exposure) after stream is acquired
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const capabilities = track.getCapabilities?.() as any;
          const advanced: Record<string, unknown> = {};
          if (capabilities?.focusMode?.includes("continuous")) {
            advanced.focusMode = "continuous";
          }
          if (capabilities?.exposureMode?.includes("continuous")) {
            advanced.exposureMode = "continuous";
          }
          if (capabilities?.whiteBalanceMode?.includes("continuous")) {
            advanced.whiteBalanceMode = "continuous";
          }
          if (Object.keys(advanced).length > 0) {
            await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints);
          }
        } catch {
          // Advanced constraints not supported — continue with defaults
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        try { await videoRef.current.play(); } catch { /* autoplay policy */ }
      }
      setIsStreaming(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setError(isIOS
          ? "Camera access denied. Go to Settings > Safari > Camera and allow access."
          : "Camera access denied. Please allow camera permissions in your browser.");
      } else if (msg.includes("NotFound")) {
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
  }, []);

  // Lazy-load Tesseract worker only when needed (OCR fallback)
  const getOcrWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: "7" as never,
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '-,./",
    });
    workerRef.current = worker;
    return worker;
  }, []);

  // ── OCR fallback ─────────────────────────────────────────────────────────────

  const runOcrFallback = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    setStatusText("Trying OCR fallback…");
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const worker = await getOcrWorker();

    // Crop the name-bar region (top ~14% of frame)
    const scale = 4;
    const sx = Math.floor(vw * 0.04);
    const sy = Math.floor(vh * 0.04);
    const sw = Math.floor(vw * 0.72);
    const sh = Math.floor(vh * 0.14);
    canvas.width = sw * scale;
    canvas.height = sh * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);

    // Greyscale + contrast
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      let g = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
      g = Math.min(255, Math.max(0, (g - 128) * 1.4 + 128));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);

    const { data } = await worker.recognize(canvas);
    return cleanOcrText(data.text);
  }, [getOcrWorker]);

  // ── Scan list actions ─────────────────────────────────────────────────────────

  const addToScanList = useCallback((card: ScryfallCard) => {
    setScanList(prev => {
      const existing = prev.find(i => i.card.id === card.id && !i.isFoil);
      if (existing) return prev.map(i => i.listId === existing.listId ? { ...i, quantity: i.quantity + 1 } : i);
      return [{ listId: `scan-${++listIdCounter}`, card, quantity: 1, isFoil: false }, ...prev];
    });
  }, []);

  const removeFromScanList = useCallback((listId: string) => {
    setScanList(prev => prev.filter(i => i.listId !== listId));
  }, []);

  const updateScanListQty = useCallback((listId: string, qty: number) => {
    if (qty <= 0) setScanList(prev => prev.filter(i => i.listId !== listId));
    else setScanList(prev => prev.map(i => i.listId === listId ? { ...i, quantity: qty } : i));
  }, []);

  const toggleItemFoil = useCallback((listId: string) => {
    setScanList(prev => prev.map(i => i.listId === listId ? { ...i, isFoil: !i.isFoil } : i));
  }, []);

  const clearScanList = useCallback(() => setScanList([]), []);

  // ── Core capture + recognize ──────────────────────────────────────────────────

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError("");
    setStatusText("Scanning…");
    setSuggestions([]);
    setMatchedCard(null);

    try {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      // Artwork region: roughly centre 40-90% width, 14-57% height of the card
      // Guide overlay is centred in the viewport — we use fixed proportions of the video frame
      const artX = Math.floor(vw * 0.07);
      const artY = Math.floor(vh * 0.14);
      const artW = Math.floor(vw * 0.86);
      const artH = Math.floor(vh * 0.43);

      // ── Phase 1: Visual hash matching ────────────────────────────────────────
      if (hasHashIndex) {
        setStatusText("Computing visual hash…");
        const dataUrl = cropArtworkToDataUrl(video, canvas, artX, artY, artW, artH);

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

          if (best.distance <= 10) {
            // Strong match — fetch full card data
            setStatusText("Match found!");
            const cardRes = await fetch(`/api/scryfall/cards/${best.id}`);
            if (cardRes.ok) {
              const card: ScryfallCard = await cardRes.json();
              if (autoScan && card.name === lastMatchedNameRef.current) return;
              lastMatchedNameRef.current = card.name;
              setMatchedCard(card);
              setStatusText("");
              return;
            }
          }

          if (best.distance <= 20 && result.matches.length > 1) {
            // Possible matches — show picker
            setStatusText("Multiple possible matches");
            const pickerItems = await Promise.all(
              result.matches.slice(0, 5).map(async m => {
                const r = await fetch(`/api/scryfall/cards/${m.id}`);
                if (!r.ok) return null;
                const c: ScryfallCard = await r.json();
                return {
                  id: c.id,
                  name: c.name,
                  imageUri: c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? null,
                  setName: c.set_name,
                  prices: { usd: c.prices?.usd },
                };
              })
            );
            setSuggestions(pickerItems.filter(Boolean) as CardScanSuggestion[]);
            setStatusText("");
            return;
          }
        }
      }

      // ── Phase 2: OCR fallback ─────────────────────────────────────────────────
      const ocrText = await runOcrFallback(video, canvas);

      if (!ocrText) {
        if (!autoScan) setError("Couldn't read the card. Align the artwork in the frame and try again.");
        return;
      }

      setStatusText("Searching by name…");

      // Fuzzy name search
      const fuzzyRes = await fetch(`/api/scryfall/named?fuzzy=${encodeURIComponent(ocrText)}`);
      if (fuzzyRes.ok) {
        const card: ScryfallCard = await fuzzyRes.json();
        if (autoScan && card.name === lastMatchedNameRef.current) return;
        lastMatchedNameRef.current = card.name;
        setMatchedCard(card);
        setStatusText("");
        return;
      }

      // Autocomplete suggest
      const suggestRes = await fetch(`/api/scryfall/suggest?q=${encodeURIComponent(ocrText)}`);
      if (suggestRes.ok) {
        const data: CardScanSuggestion[] = await suggestRes.json();
        if (data.length === 1) {
          const r = await fetch(`/api/scryfall/cards/${data[0].id}`);
          if (r.ok) {
            const card: ScryfallCard = await r.json();
            if (autoScan && card.name === lastMatchedNameRef.current) return;
            lastMatchedNameRef.current = card.name;
            setMatchedCard(card);
            setStatusText("");
            return;
          }
        } else if (data.length > 1) {
          setSuggestions(data.slice(0, 6));
          setStatusText("");
          return;
        }
      }

      if (!autoScan) {
        setError(`Couldn't identify this card. Try adjusting the angle or lighting.`);
      }
    } catch (err) {
      if (!autoScan) setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      if (!matchedCard) setStatusText("");
    }
  }, [hasHashIndex, runOcrFallback, autoScan]);

  // ── Auto-scan loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoScan || !isStreaming) {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
      return;
    }
    function scheduleNext() {
      autoScanTimerRef.current = setTimeout(async () => {
        if (!isProcessingRef.current) await captureAndRecognize();
        scheduleNext();
      }, 2500);
    }
    scheduleNext();
    return () => { if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current); };
  }, [autoScan, isStreaming, captureAndRecognize]);

  const selectSuggestion = useCallback(async (id: string) => {
    setIsProcessing(true);
    const res = await fetch(`/api/scryfall/cards/${id}`);
    if (res.ok) {
      const card: ScryfallCard = await res.json();
      lastMatchedNameRef.current = card.name;
      setMatchedCard(card);
      setSuggestions([]);
    }
    setIsProcessing(false);
  }, []);

  const reset = useCallback(() => {
    setMatchedCard(null);
    setSuggestions([]);
    setStatusText("");
    setError("");
    lastMatchedNameRef.current = "";
  }, []);

  return {
    videoRef, canvasRef, isStreaming, isProcessing, statusText,
    suggestions, matchedCard, error, hasHashIndex,
    scanList, totalValue, addToScanList, removeFromScanList,
    updateScanListQty, toggleItemFoil, clearScanList,
    autoScan, setAutoScan,
    startCamera, stopCamera, captureAndRecognize, selectSuggestion, reset,
  };
}
