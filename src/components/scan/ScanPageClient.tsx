"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HeroBanner from "@/components/layout/HeroBanner";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { ScryfallCard } from "@/types/card";

type CameraFacing = "environment" | "user";

interface ScanResult {
  identified: boolean;
  confidence: number;
  reasoning: string;
  card?: ScryfallCard | null;
  cardName?: string;
  setCode?: string;
  error?: string;
}

const SCAN_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);

export default function ScanPageClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (facing: CameraFacing = cameraFacing) => {
    stopCamera();
    setError(null);
    setResult(null);
    setCapturedImage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraFacing(facing);
    } catch {
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  }, [cameraFacing, stopCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const captureAndIdentify = useCallback(async (imageDataUrl: string) => {
    setScanning(true);
    setResult(null);
    setError(null);
    setCapturedImage(imageDataUrl);
    stopCamera();

    try {
      const res = await fetch("/api/scan/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      const data: ScanResult = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Identification failed. Try again.");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setScanning(false);
    }
  }, [stopCamera]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera not ready yet. Please wait a moment and try again.");
      return;
    }

    const canvas = canvasRef.current;
    const maxDim = 1024;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    captureAndIdentify(dataUrl);
  }, [captureAndIdentify]);

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
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      captureAndIdentify(dataUrl);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  }, [captureAndIdentify]);

  const flipCamera = useCallback(() => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    startCamera(newFacing);
  }, [cameraFacing, startCamera]);

  const resetScanner = useCallback(() => {
    setResult(null);
    setError(null);
    setCapturedImage(null);
    setScanning(false);
  }, []);

  const card = result?.card;
  const cardImage = card?.image_uris?.normal ?? card?.card_faces?.[0]?.image_uris?.normal;

  return (
    <div className="flex flex-col min-h-screen pb-20 animate-page-enter">
      <HeroBanner
        title="SCANNER"
        subtitle="Identify cards with AI"
        accent="#10B981"
        icon={SCAN_ICON}
      />

      <div className="px-4 max-w-2xl mx-auto w-full space-y-4">
        {/* Camera / Capture area */}
        {!result && !scanning && !capturedImage && (
          <>
            {cameraActive ? (
              <div className="relative rounded-2xl overflow-hidden border border-border bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-[3/4] object-cover"
                />

                {/* Scan guide overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-8 border-2 border-white/30 rounded-xl" />
                  <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                </div>

                <p className="absolute top-3 left-0 right-0 text-center text-xs text-white/60">
                  Position card within the frame
                </p>

                {/* Camera controls */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
                  <button
                    onClick={stopCamera}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm text-white/80 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <button
                    onClick={captureFrame}
                    className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform"
                  >
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </button>

                  <button
                    onClick={flipCamera}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm text-white/80 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
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
                    <p className="text-xs text-text-muted mt-0.5">Point at any MTG card to identify it</p>
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
              </div>
            )}
          </>
        )}

        {/* Scanning state */}
        {scanning && (
          <div className="glass-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured card"
                className="w-48 rounded-xl border border-border opacity-60"
              />
            )}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-secondary">Identifying card with AI...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !scanning && (
          <div className="glass-card border border-red-500/20 rounded-2xl p-4 bg-red-500/5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-400">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={resetScanner}>
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !scanning && (
          <div className="space-y-4">
            {result.identified && card ? (
              <>
                {/* Confidence bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-bg-card overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        result.confidence >= 0.8 ? "bg-emerald-500" :
                        result.confidence >= 0.5 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${result.confidence * 100}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-xs font-semibold",
                    result.confidence >= 0.8 ? "text-emerald-400" :
                    result.confidence >= 0.5 ? "text-amber-400" : "text-red-400"
                  )}>
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>

                {/* Card result */}
                <div className="glass-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex gap-4 p-4">
                    {cardImage && (
                      <img
                        src={cardImage}
                        alt={card.name}
                        className="w-28 rounded-lg shadow-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <h3 className="text-base font-bold text-text-primary truncate">{card.name}</h3>
                        <p className="text-xs text-text-muted">{card.set_name} &middot; {card.collector_number}</p>
                      </div>
                      <p className="text-xs text-text-secondary">{card.type_line}</p>
                      {card.oracle_text && (
                        <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">{card.oracle_text}</p>
                      )}
                      <div className="flex items-center gap-3 pt-1">
                        {card.prices.usd && (
                          <span className="text-xs font-semibold text-emerald-400">${card.prices.usd}</span>
                        )}
                        {card.prices.usd_foil && (
                          <span className="text-xs text-text-muted">Foil: ${card.prices.usd_foil}</span>
                        )}
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase",
                          card.rarity === "mythic" ? "bg-orange-500/15 text-orange-400" :
                          card.rarity === "rare" ? "bg-amber-500/15 text-amber-400" :
                          card.rarity === "uncommon" ? "bg-slate-400/15 text-slate-300" :
                          "bg-slate-600/15 text-slate-400"
                        )}>
                          {card.rarity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-border p-3 flex gap-2">
                    <Link
                      href={`/search/${card.id}`}
                      className="flex-1 py-2 rounded-xl text-center text-sm font-medium btn-gradient text-white"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={resetScanner}
                      className="flex-1 py-2 rounded-xl text-center text-sm font-medium bg-bg-card border border-border text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Scan Another
                    </button>
                  </div>
                </div>

                {result.reasoning && (
                  <p className="text-[11px] text-text-muted text-center px-4">{result.reasoning}</p>
                )}
              </>
            ) : result.identified && !card ? (
              <div className="glass-card border border-border rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Possible match: {result.cardName}
                  </p>
                  {result.setCode && (
                    <p className="text-xs text-text-muted mt-0.5">Set: {result.setCode.toUpperCase()}</p>
                  )}
                  <p className="text-xs text-text-muted mt-1">{result.reasoning}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Link
                    href={`/search?q=${encodeURIComponent(result.cardName ?? "")}`}
                    className="px-4 py-2 rounded-xl text-sm font-medium btn-gradient text-white"
                  >
                    Search for Card
                  </Link>
                  <Button variant="secondary" size="sm" onClick={resetScanner}>
                    Scan Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass-card border border-border rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">No card detected</p>
                  <p className="text-xs text-text-muted mt-1">{result.reasoning}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={resetScanner}>
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tips section */}
        {!cameraActive && !result && !scanning && !error && (
          <div className="glass-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-text-primary">Tips for best results</p>
            <ul className="text-xs text-text-muted space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&#9679;</span>
                Good lighting — avoid glare on foil cards
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&#9679;</span>
                Keep the card flat and fill the frame
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&#9679;</span>
                Hold steady for a clear, focused image
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">&#9679;</span>
                Works with any language or edition
              </li>
            </ul>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
