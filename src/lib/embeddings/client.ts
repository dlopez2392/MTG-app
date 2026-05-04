import OpenAI from "openai";

let client: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? "",
    });
  }
  return client;
}

/**
 * Embed a single text string using OpenAI text-embedding-3-small (1536 dims).
 */
export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

/**
 * Embed a batch of texts, processing 100 at a time with 200ms delay between batches.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const results: number[][] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    for (const item of res.data) {
      results.push(item.embedding);
    }
  }

  return results;
}
