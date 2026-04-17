import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { dHashFromRaw, findMatches, type HashEntry, type HashIndex } from "@/lib/scan/dhash";

// Module-level cache — survives across warm requests on the same instance
let cachedIndex: HashEntry[] | null = null;
let indexLoaded = false;

function getHashIndex(): HashEntry[] | null {
  if (indexLoaded) return cachedIndex;
  indexLoaded = true;
  try {
    const filePath = join(process.cwd(), "public", "card-hashes.json");
    const raw = readFileSync(filePath, "utf8");
    const data: HashIndex = JSON.parse(raw);
    cachedIndex = data.cards ?? [];
    return cachedIndex;
  } catch {
    // Index not built yet — scanner will fall back to OCR
    cachedIndex = null;
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { image?: string };
    const dataUrl = body.image;

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    // Strip data URL prefix — expect "data:image/jpeg;base64,..."
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64, "base64");

    // Dynamically import sharp (native module)
    const sharp = (await import("sharp")).default;

    // Resize to 9×8 greyscale — the dHash input
    const { data: pixels } = await sharp(imageBuffer)
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const queryHash = dHashFromRaw(pixels);

    const index = getHashIndex();

    if (!index || index.length === 0) {
      // No index yet — tell client to fall back to OCR
      return NextResponse.json({ indexed: false, hash: queryHash });
    }

    const matches = findMatches(queryHash, index);

    return NextResponse.json({
      indexed: true,
      hash: queryHash,
      matches,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
