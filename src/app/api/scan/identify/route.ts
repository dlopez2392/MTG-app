import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchCards } from "@/lib/scryfall/client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const SYSTEM_PROMPT = `You are an expert Magic: The Gathering card identifier. You will be shown a photo of an MTG card. Your job is to identify the exact card name and set.

Rules:
- Return ONLY valid JSON, no markdown fences
- If you can clearly identify the card, return high confidence
- If the image is blurry, partial, or you're unsure, return lower confidence
- For double-faced or split cards, identify the visible face
- If you cannot identify any MTG card in the image, return cardName as null

Response format:
{
  "cardName": "exact card name" | null,
  "setCode": "three-letter set code if identifiable" | null,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of identification"
}`;

interface GeminiResult {
  cardName: string | null;
  setCode: string | null;
  confidence: number;
  reasoning: string;
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Scanner not configured. Add GEMINI_API_KEY to environment variables." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { image } = body as { image?: string };

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const base64Match = image.match(/^data:image\/([\w+]+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ error: "Invalid image format. Expected base64 data URI." }, { status: 400 });
    }

    const mimeType = `image/${base64Match[1]}` as "image/jpeg" | "image/png" | "image/webp";
    const base64Data = base64Match[2];

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType, data: base64Data } },
            { text: "Identify this Magic: The Gathering card." },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const geminiResult: GeminiResult = JSON.parse(cleaned);

    if (!geminiResult.cardName) {
      return NextResponse.json({
        identified: false,
        confidence: geminiResult.confidence,
        reasoning: geminiResult.reasoning,
      });
    }

    let scryfallQuery = `!"${geminiResult.cardName}"`;
    if (geminiResult.setCode) {
      scryfallQuery += ` set:${geminiResult.setCode}`;
    }

    try {
      const scryfallResult = await searchCards(scryfallQuery, 1, "released", "desc");
      if (scryfallResult.data.length > 0) {
        return NextResponse.json({
          identified: true,
          confidence: geminiResult.confidence,
          reasoning: geminiResult.reasoning,
          card: scryfallResult.data[0],
        });
      }
    } catch {
      // Scryfall lookup failed — try fuzzy name search
    }

    try {
      const fuzzyResult = await searchCards(geminiResult.cardName, 1, "released", "desc");
      if (fuzzyResult.data.length > 0) {
        return NextResponse.json({
          identified: true,
          confidence: Math.min(geminiResult.confidence, 0.8),
          reasoning: geminiResult.reasoning,
          card: fuzzyResult.data[0],
        });
      }
    } catch {
      // Fuzzy search also failed
    }

    return NextResponse.json({
      identified: true,
      confidence: geminiResult.confidence,
      reasoning: geminiResult.reasoning,
      cardName: geminiResult.cardName,
      setCode: geminiResult.setCode,
      card: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Card identification failed";
    console.error("Scan identify error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
