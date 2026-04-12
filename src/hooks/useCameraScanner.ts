"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cleanOcrText, preprocessImageData } from "@/lib/ocr/cardNameExtractor";
import type { ScryfallCard } from "@/types/card";

export interface CardScanSuggestion {
  id: string;
  name: string;
  imageUri: string | null;
  setName: string | null;
  prices: { usd?: string | null };
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
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureAndRecognize: () => Promise<void>;
  selectSuggestion: (id: string) => Promise<void>;
  reset: () => void;
}

// How much to scale the crop before OCR — bigger = better accuracy
const OCR_SCALE = 4;

export function useCameraScanner(): UseCameraScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<import("tesseract.js").Worker | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [suggestions, setSuggestions] = useState<CardScanSuggestion[]>([]);
  const [matchedCard, setMatchedCard] = useState<ScryfallCard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      workerRef.current?.terminate();
    };
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
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
        setError("Camera access denied. Please allow camera permissions in your browser.");
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
  }, []);

  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    // PSM 7 = single text line — much better for card name bars
    await worker.setParameters({
      tessedit_pageseg_mode: "7" as never,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '-,./",
    });
    workerRef.current = worker;
    return worker;
  }, []);

  /** Run OCR on the current canvas content and return cleaned text + confidence */
  async function runOcr(worker: Awaited<ReturnType<typeof getWorker>>, canvas: HTMLCanvasElement) {
    const { data } = await worker.recognize(canvas);
    return { text: cleanOcrText(data.text), confidence: data.confidence };
  }

  /** Draw a scaled-up crop of the source onto the canvas */
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

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsProcessing(true);
    setError("");
    setOcrText("");
    setSuggestions([]);
    setMatchedCard(null);

    try {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      // Crop: top 5–18% of frame (card title bar), ignoring mana cost on right
      const sx = Math.floor(vw * 0.04);
      const sy = Math.floor(vh * 0.04);
      const sw = Math.floor(vw * 0.72);
      const sh = Math.floor(vh * 0.14);

      const worker = await getWorker();

      // Attempt 1: standard threshold (light text on dark bg — colored cards)
      const { ctx: ctx1, dw, dh } = drawCrop(video, canvas, sx, sy, sw, sh);
      preprocessImageData(ctx1, dw, dh, false);
      const r1 = await runOcr(worker, canvas);

      // Attempt 2: inverted threshold (dark text on light bg — white/artifact cards)
      const { ctx: ctx2 } = drawCrop(video, canvas, sx, sy, sw, sh);
      preprocessImageData(ctx2, dw, dh, true);
      const r2 = await runOcr(worker, canvas);

      // Pick whichever result has higher confidence and a usable string
      let cleaned = "";
      if (r1.confidence >= r2.confidence && r1.text.length >= 2) {
        cleaned = r1.text;
      } else if (r2.text.length >= 2) {
        cleaned = r2.text;
      } else {
        cleaned = r1.text || r2.text;
      }

      setOcrText(cleaned);

      if (!cleaned) {
        setError("Couldn't read the card name. Align the name in the box and try again.");
        return;
      }

      // First try an exact fuzzy match on Scryfall
      const fuzzyRes = await fetch(`/api/scryfall/named?fuzzy=${encodeURIComponent(cleaned)}`);
      if (fuzzyRes.ok) {
        const card: ScryfallCard = await fuzzyRes.json();
        setMatchedCard(card);
        return;
      }

      // Fuzzy failed — get multiple suggestions so user can pick
      const suggestRes = await fetch(`/api/scryfall/suggest?q=${encodeURIComponent(cleaned)}`);
      if (suggestRes.ok) {
        const data: CardScanSuggestion[] = await suggestRes.json();
        if (data.length > 0) {
          if (data.length === 1) {
            // Only one match — auto-select
            await selectSuggestionById(data[0].id);
          } else {
            setSuggestions(data.slice(0, 6));
          }
          return;
        }
      }

      // Nothing found at all
      setError(
        `Read "${cleaned}" but couldn't find a matching card. Try again or tap Search Manually.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [getWorker]);

  async function selectSuggestionById(id: string) {
    const res = await fetch(`/api/scryfall/cards/${id}`);
    if (res.ok) {
      setMatchedCard(await res.json());
      setSuggestions([]);
    }
  }

  const selectSuggestion = useCallback(async (id: string) => {
    setIsProcessing(true);
    await selectSuggestionById(id);
    setIsProcessing(false);
  }, []);

  const reset = useCallback(() => {
    setMatchedCard(null);
    setSuggestions([]);
    setOcrText("");
    setError("");
  }, []);

  return {
    videoRef, canvasRef, isStreaming, isProcessing,
    ocrText, suggestions, matchedCard, error,
    startCamera, stopCamera, captureAndRecognize, selectSuggestion, reset,
  };
}
