"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cleanOcrText, preprocessImageData } from "@/lib/ocr/cardNameExtractor";
import type { ScryfallCard } from "@/types/card";

interface UseCameraScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isStreaming: boolean;
  isProcessing: boolean;
  ocrText: string;
  matchedCard: ScryfallCard | null;
  error: string;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureAndRecognize: () => Promise<void>;
  reset: () => void;
}

export function useCameraScanner(): UseCameraScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<import("tesseract.js").Worker | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [matchedCard, setMatchedCard] = useState<ScryfallCard | null>(null);
  const [error, setError] = useState("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        try { await videoRef.current.play(); } catch { /* autoPlay policy — video will play when user interacts */ }
      }
      setIsStreaming(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setError("Camera access denied. Please allow camera permissions in your browser.");
      } else if (msg.includes("NotFoundError")) {
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera. Try uploading a photo instead.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    workerRef.current = worker;
    return worker;
  }, []);

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsProcessing(true);
    setError("");
    setOcrText("");
    setMatchedCard(null);

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // Crop to the top ~18% of the frame (card title bar area)
      // Assuming the card is roughly centered and fills most of the frame
      const cropY = Math.floor(vh * 0.05);
      const cropH = Math.floor(vh * 0.13);
      const cropX = Math.floor(vw * 0.05);
      const cropW = Math.floor(vw * 0.75);

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      // Draw cropped region
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Preprocess for better OCR
      preprocessImageData(ctx, cropW, cropH);

      // Run OCR
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      const cleaned = cleanOcrText(data.text);
      setOcrText(cleaned);

      if (!cleaned) {
        setError("Could not read card name. Try adjusting the angle or lighting.");
        return;
      }

      // Look up on Scryfall using fuzzy match
      const res = await fetch(
        `/api/scryfall/named?fuzzy=${encodeURIComponent(cleaned)}`
      );

      if (res.ok) {
        const card: ScryfallCard = await res.json();
        setMatchedCard(card);
      } else {
        // Try autocomplete as fallback
        const autoRes = await fetch(
          `/api/scryfall/autocomplete?q=${encodeURIComponent(cleaned)}`
        );
        if (autoRes.ok) {
          const autoData = await autoRes.json();
          const suggestions: string[] = autoData.data ?? autoData;
          if (suggestions.length > 0) {
            // Try the first suggestion
            const namedRes = await fetch(
              `/api/scryfall/named?exact=${encodeURIComponent(suggestions[0])}`
            );
            if (namedRes.ok) {
              const card: ScryfallCard = await namedRes.json();
              setMatchedCard(card);
            } else {
              setError(
                `Read "${cleaned}" but no card matched. Try again or search manually.`
              );
            }
          } else {
            setError(
              `Read "${cleaned}" but no card matched. Try again or search manually.`
            );
          }
        } else {
          setError(
            `Read "${cleaned}" but no card matched. Try again or search manually.`
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Scan failed. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  }, [getWorker]);

  const reset = useCallback(() => {
    setMatchedCard(null);
    setOcrText("");
    setError("");
  }, []);

  return {
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
  };
}
