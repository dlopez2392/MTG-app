import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/scan/identify
 *
 * Accepts a base64 card image and uses cloud vision AI to identify the MTG card.
 * Supports: OpenAI Vision (GPT-4o-mini) or Google Cloud Vision OCR.
 * Falls back gracefully when no API key is configured.
 */

interface IdentifyResult {
  provider: "openai" | "google" | "none";
  cardName: string | null;
  confidence: "high" | "medium" | "low";
  raw?: string;
}

// ── OpenAI Vision ────────────────────────────────────────────────────────────

async function identifyWithOpenAI(imageBase64: string): Promise<IdentifyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: "none", cardName: null, confidence: "low" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content:
            "You are an MTG card identifier. Given an image of a Magic: The Gathering card, respond with ONLY the exact card name. If you can see the card name text, use that. If you can only see the artwork, identify the card from the art. If you cannot identify the card, respond with UNKNOWN. Do not include set name, collector number, or any other text — just the card name exactly as printed.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
                detail: "low",
              },
            },
            { type: "text", text: "What Magic: The Gathering card is this?" },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[scan/identify] OpenAI error:", res.status, err);
    return { provider: "openai", cardName: null, confidence: "low" };
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content?.trim() ?? "";

  if (!raw || raw === "UNKNOWN" || raw.length < 2) {
    return { provider: "openai", cardName: null, confidence: "low", raw };
  }

  // Clean up — remove quotes, periods, extra whitespace
  const cleaned = raw.replace(/^["']|["']$/g, "").replace(/\.$/, "").trim();

  return {
    provider: "openai",
    cardName: cleaned,
    confidence: cleaned.length > 2 ? "high" : "low",
    raw,
  };
}

// ── Google Cloud Vision OCR ──────────────────────────────────────────────────

async function identifyWithGoogleVision(imageBase64: string): Promise<IdentifyResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return { provider: "none", cardName: null, confidence: "low" };

  const base64Content = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Content },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 10 },
              { type: "TEXT_DETECTION", maxResults: 10 },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    console.error("[scan/identify] Google Vision error:", res.status);
    return { provider: "google", cardName: null, confidence: "low" };
  }

  const data = await res.json();
  const fullText: string =
    data.responses?.[0]?.textAnnotations?.[0]?.description ?? "";

  if (!fullText) {
    return { provider: "google", cardName: null, confidence: "low", raw: "" };
  }

  // Card name is typically the first line. Filter out mana symbols, set info, etc.
  const lines = fullText
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => {
      if (l.length < 2) return false;
      // Skip lines that look like mana costs, set codes, or collector numbers
      if (/^[{(\d]/.test(l)) return false;
      if (/^\d+\/\d+$/.test(l)) return false;
      // Skip lines that are just symbols or numbers
      if (/^[^a-zA-Z]*$/.test(l)) return false;
      return true;
    });

  const cardName = lines[0] ?? null;

  return {
    provider: "google",
    cardName,
    confidence: cardName && cardName.length > 2 ? "high" : "low",
    raw: fullText,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_CLOUD_VISION_API_KEY;
  return NextResponse.json({
    available: hasOpenAI || hasGoogle,
    providers: {
      openai: hasOpenAI,
      google: hasGoogle,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const image: string | undefined = body.image;

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    // Try Google Cloud Vision first (free tier: 1000 units/month)
    const googleResult = await identifyWithGoogleVision(image);
    if (googleResult.cardName) {
      return NextResponse.json(googleResult);
    }

    // Fall back to OpenAI Vision (paid, but best at identifying from artwork)
    const openaiResult = await identifyWithOpenAI(image);
    if (openaiResult.cardName) {
      return NextResponse.json(openaiResult);
    }

    // No provider available or no identification
    return NextResponse.json({
      provider: "none",
      cardName: null,
      confidence: "low",
      available: !!process.env.OPENAI_API_KEY || !!process.env.GOOGLE_CLOUD_VISION_API_KEY,
    });
  } catch (err) {
    console.error("[scan/identify] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Identification failed" },
      { status: 500 }
    );
  }
}
