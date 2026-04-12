"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cleanOcrText, grayscaleEnhance, preprocessImageData } from "@/lib/ocr/cardNameExtractor";
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
  ocrText: string;
  suggestions: CardScanSuggestion[];
  matchedCard: ScryfallCard | null;
  error: string;
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

const OCR_SCALE = 4;
let listIdCounter = 0;

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
  const [ocrText, setOcrText] = useState("");
  const [suggestions, setSuggestions] = useState<CardScanSuggestion[]>([]);
  const [matchedCard, setMatchedCard] = useState<ScryfallCard | null>(null);
  const [error, setError] = useState("");
  const [scanList, setScanList] = useState<ScanListItem[]>([]);
  const [autoScan, setAutoScan] = useState(false);

  const totalValue = scanList.reduce((sum, item) => {
    const price = parseFloat(
      (item.isFoil ? item.card.prices?.usd_foil : item.card.prices?.usd) ?? item.card.prices?.usd ?? "0"
    );
    return sum + price * item.quantity;
  }, 0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      workerRef.current?.terminate();
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // "ideal" (not exact) so iOS Safari falls back gracefully if back camera unavailable
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
      });
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
        setError(
          isIOS
            ? "Camera access denied. Go to Settings > Safari > Camera and allow access."
            : "Camera access denied. Please allow camera permissions in your browser."
        );
      } else if (msg.includes("NotFound")) {
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
  }, []);

  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: "7" as never,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '-,./",
    });
    workerRef.current = worker;
    return worker;
  }, []);

  async function runOcr(worker: Awaited<ReturnType<typeof getWorker>>, canvas: HTMLCanvasElement) {
    const { data } = await worker.recognize(canvas);
    return { text: cleanOcrText(data.text), confidence: data.confidence };
  }

  function drawCrop(
    source: HTMLVideoElement | HTMLImageElement,
    canvas: HTMLCanvasElement,
    sx: number, sy: number, sw: number, sh: number
  ) {
    const dw = sw * OCR_SCALE;
    const dh = sh * OCR_SCALE;
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
    return { ctx, dw, dh };
  }

  function pickBest(attempts: Array<{ text: string; confidence: number }>): string {
    let best = attempts[0];
    for (const a of attempts) {
      if (
        a.text.length > best.text.length ||
        (a.text.length === best.text.length && a.confidence > best.confidence)
      ) best = a;
    }
    return best.text;
  }

  // ── Scan list actions ──────────────────────────────────────────────────────

  const addToScanList = useCallback((card: ScryfallCard) => {
    setScanList((prev) => {
      const existing = prev.find((i) => i.card.id === card.id && !i.isFoil);
      if (existing) {
        return prev.map((i) => i.listId === existing.listId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [{ listId: `scan-${++listIdCounter}`, card, quantity: 1, isFoil: false }, ...prev];
    });
  }, []);

  const removeFromScanList = useCallback((listId: string) => {
    setScanList((prev) => prev.filter((i) => i.listId !== listId));
  }, []);

  const updateScanListQty = useCallback((listId: string, qty: number) => {
    if (qty <= 0) {
      setScanList((prev) => prev.filter((i) => i.listId !== listId));
    } else {
      setScanList((prev) => prev.map((i) => i.listId === listId ? { ...i, quantity: qty } : i));
    }
  }, []);

  const toggleItemFoil = useCallback((listId: string) => {
    setScanList((prev) => prev.map((i) => i.listId === listId ? { ...i, isFoil: !i.isFoil } : i));
  }, []);

  const clearScanList = useCallback(() => setScanList([]), []);

  // ── Core scan logic ────────────────────────────────────────────────────────

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError("");
    setOcrText("");
    setSuggestions([]);
    setMatchedCard(null);

    try {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const worker = await getWorker();

      const attempts: Array<{ text: string; confidence: number }> = [];

      const axA = Math.floor(vw * 0.04);
      const ayA = Math.floor(vh * 0.04);
      const awA = Math.floor(vw * 0.72);
      const ahA = Math.floor(vh * 0.14);

      const axB = Math.floor(vw * 0.04);
      const ayB = Math.floor(vh * 0.08);
      const awB = Math.floor(vw * 0.72);
      const ahB = Math.floor(vh * 0.14);

      { const { ctx, dw, dh } = drawCrop(video, canvas, axA, ayA, awA, ahA); grayscaleEnhance(ctx, dw, dh); attempts.push(await runOcr(worker, canvas)); }
      { const { ctx, dw, dh } = drawCrop(video, canvas, axA, ayA, awA, ahA); preprocessImageData(ctx, dw, dh, false, 128); attempts.push(await runOcr(worker, canvas)); }
      { const { ctx, dw, dh } = drawCrop(video, canvas, axA, ayA, awA, ahA); preprocessImageData(ctx, dw, dh, true, 128); attempts.push(await runOcr(worker, canvas)); }
      { const { ctx, dw, dh } = drawCrop(video, canvas, axB, ayB, awB, ahB); grayscaleEnhance(ctx, dw, dh); attempts.push(await runOcr(worker, canvas)); }

      const cleaned = pickBest(attempts);
      setOcrText(cleaned);

      if (!cleaned) {
        if (!autoScan) setError("Couldn't read the card name. Align the name in the box and try again.");
        return;
      }

      const fuzzyRes = await fetch(`/api/scryfall/named?fuzzy=${encodeURIComponent(cleaned)}`);
      if (fuzzyRes.ok) {
        const card: ScryfallCard = await fuzzyRes.json();
        // In auto-scan: skip if same card as last match (dedup)
        if (autoScan && card.name === lastMatchedNameRef.current) return;
        lastMatchedNameRef.current = card.name;
        setMatchedCard(card);
        return;
      }

      const suggestRes = await fetch(`/api/scryfall/suggest?q=${encodeURIComponent(cleaned)}`);
      if (suggestRes.ok) {
        const data: CardScanSuggestion[] = await suggestRes.json();
        if (data.length > 0) {
          if (data.length === 1) {
            const res = await fetch(`/api/scryfall/cards/${data[0].id}`);
            if (res.ok) {
              const card: ScryfallCard = await res.json();
              if (autoScan && card.name === lastMatchedNameRef.current) return;
              lastMatchedNameRef.current = card.name;
              setMatchedCard(card);
            }
          } else {
            setSuggestions(data.slice(0, 6));
          }
          return;
        }
      }

      if (!autoScan) {
        setError(`Read "${cleaned}" but couldn't find a matching card. Try again or search manually.`);
      }
    } catch (err) {
      if (!autoScan) setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [getWorker, autoScan]);

  // ── Auto-scan loop ─────────────────────────────────────────────────────────

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
    return () => {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    };
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
    setOcrText("");
    setError("");
    lastMatchedNameRef.current = "";
  }, []);

  return {
    videoRef, canvasRef, isStreaming, isProcessing,
    ocrText, suggestions, matchedCard, error,
    scanList, totalValue, addToScanList, removeFromScanList,
    updateScanListQty, toggleItemFoil, clearScanList,
    autoScan, setAutoScan,
    startCamera, stopCamera, captureAndRecognize, selectSuggestion, reset,
  };
}
