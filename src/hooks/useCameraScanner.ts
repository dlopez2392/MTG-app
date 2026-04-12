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

// Scale crop up before sending to OCR — bigger = better accuracy
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
    // PSM 7 = single text line — best for card name bars
    await worker.setParameters({
      tessedit_pageseg_mode: "7" as never,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '-,./",
    });
    workerRef.current = worker;
    return worker;
  }, []);

  /** Run OCR on the current canvas content */
  async function runOcr(worker: Awaited<ReturnType<typeof getWorker>>, canvas: HTMLCanvasElement) {
    const { data } = await worker.recognize(canvas);
    return { text: cleanOcrText(data.text), confidence: data.confidence };
  }

  /** Draw a scaled-up crop of the source onto the canvas, returns context + dims */
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

  /** Pick the best OCR result from several attempts */
  function pickBest(
    attempts: Array<{ text: string; confidence: number }>
  ): string {
    // Prefer longest text; break ties by confidence
    let best = attempts[0];
    for (const a of attempts) {
      if (
        a.text.length > best.text.length ||
        (a.text.length === best.text.length && a.confidence > best.confidence)
      ) {
        best = a;
      }
    }
    return best.text;
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

      const worker = await getWorker();

      // Run 4 attempts across two crop regions and three preprocessing modes,
      // then pick the result with the most usable text.
      const attempts: Array<{ text: string; confidence: number }> = [];

      // Crop A: matches the guide overlay (top of card)
      const axA = Math.floor(vw * 0.04);
      const ayA = Math.floor(vh * 0.04);
      const awA = Math.floor(vw * 0.72);
      const ahA = Math.floor(vh * 0.14);

      // Crop B: shifted down slightly in case card sits lower in frame
      const axB = Math.floor(vw * 0.04);
      const ayB = Math.floor(vh * 0.08);
      const awB = Math.floor(vw * 0.72);
      const ahB = Math.floor(vh * 0.14);

      // Attempt 1 — Crop A, grayscale enhanced (no threshold, Tesseract handles binarization)
      {
        const { ctx, dw, dh } = drawCrop(video, canvas, axA, ayA, awA, ahA);
        grayscaleEnhance(ctx, dw, dh);
        attempts.push(await runOcr(worker, canvas));
      }

      // Attempt 2 — Crop A, hard threshold (light text on dark bg — colored cards)
      {
        const { ctx, dw, dh } = drawCrop(video, canvas, axA, ayA, awA, ahA);
        preprocessImageData(ctx, dw, dh, false, 128);
        attempts.push(await runOcr(worker, canvas));
      }

      // Attempt 3 — Crop A, inverted threshold (dark text on light bg — white/artifact)
      {
        const { ctx, dw, dh } = drawCrop(video, canvas, axA, ayA, awA, ahA);
        preprocessImageData(ctx, dw, dh, true, 128);
        attempts.push(await runOcr(worker, canvas));
      }

      // Attempt 4 — Crop B, grayscale enhanced (shifted crop fallback)
      {
        const { ctx, dw, dh } = drawCrop(video, canvas, axB, ayB, awB, ahB);
        grayscaleEnhance(ctx, dw, dh);
        attempts.push(await runOcr(worker, canvas));
      }

      const cleaned = pickBest(attempts);
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
            await selectSuggestionById(data[0].id);
          } else {
            setSuggestions(data.slice(0, 6));
          }
          return;
        }
      }

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
