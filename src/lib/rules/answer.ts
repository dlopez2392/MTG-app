import { getDeepSeek } from "@/lib/deepseek/client";
import { RuleChunk } from "./retrieval";

export interface RulingResponse {
  ruling: string;
  confidence: "high" | "medium" | "low";
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
}

const SYSTEM_PROMPT = `You are Harry, an expert Magic: The Gathering rules judge. Answer using only the provided rules and card text. Cite specific rule numbers. If uncertain, say so.

Return ONLY valid JSON with these fields:
- "ruling": your answer explaining the ruling clearly
- "confidence": "high", "medium", or "low"
- "citedRules": array of { "number": "rule number", "text": "rule text" }
- "cardsAnalyzed": array of { "name": "card name", "oracleText": "oracle text" }

Do not include markdown fences. Only use rules and card text provided below.`;

export async function generateRuling(
  question: string,
  ruleChunks: RuleChunk[],
  cardOracleTexts: { name: string; oracleText: string }[],
  complexity: "simple" | "complex"
): Promise<RulingResponse> {
  const deepseek = getDeepSeek();
  const isComplex = complexity === "complex";
  const model = isComplex ? "deepseek-v4-pro" : "deepseek-v4-flash";
  const maxTokens = isComplex ? 8192 : 4096;

  const rulesContext = ruleChunks
    .map((c) => `[${c.sourceId}] ${c.content}`)
    .join("\n\n");

  const cardContext =
    cardOracleTexts.length > 0
      ? "\n\nCards:\n" +
        cardOracleTexts.map((c) => `- ${c.name}: ${c.oracleText}`).join("\n")
      : "";

  const result = await deepseek.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Question: ${question}\n\nRelevant Rules:\n${rulesContext}${cardContext}`,
      },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/,\s*\{[^}]*$/, "")
      .replace(/,?\s*$/, "")
      .replace(/("ruling"\s*:\s*"(?:[^"\\]|\\.)*)$/, '$1...(truncated)"');
    try {
      parsed = JSON.parse(repaired.endsWith("}") ? repaired : repaired + "]}");
    } catch {
      parsed = { ruling: cleaned.slice(0, 2000), confidence: "low" };
    }
  }

  return {
    ruling: parsed.ruling ?? "",
    confidence: (["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low") as "high" | "medium" | "low",
    citedRules: parsed.citedRules ?? parsed.cited_rules ?? [],
    cardsAnalyzed: parsed.cardsAnalyzed ?? parsed.cards_analyzed ?? cardOracleTexts,
    model: isComplex ? "pro" : "flash",
  };
}
