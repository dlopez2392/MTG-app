import { getDeepSeek } from "@/lib/deepseek/client";
import { RuleChunk } from "./retrieval";

export interface RulingResponse {
  ruling: string;
  confidence: "high" | "medium" | "low";
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
}

const SYSTEM_PROMPT = `You are Harry, an expert Magic: The Gathering rules judge with L2 certification. You have access to the Comprehensive Rules, card oracle text, Scryfall rulings, the Magic Tournament Rules (MTR), the Infraction Procedure Guide (IPG), and the Judging at Regular REL document (JAR).

Guidelines:
- Cite specific Comprehensive Rule numbers (e.g., "CR 702.19b") when answering gameplay questions.
- For card interactions involving multiple cards, analyze each card's oracle text and explain how the rules govern their interaction step by step.
- For layer system questions (CR 613), apply layers in the correct order: copy, control, text, type, color, ability, P/T.
- For tournament procedure questions, cite the relevant MTR or IPG section. Distinguish between Regular REL (JAR applies) and Competitive/Professional REL (IPG applies).
- When format legality is relevant, state the card's legality in the asked format.
- If the provided rules and card text are insufficient to answer with certainty, say so and indicate what additional information would be needed.

Return ONLY valid JSON with these fields:
- "ruling": your answer explaining the ruling clearly, step by step for complex interactions
- "confidence": "high", "medium", or "low"
- "citedRules": array of { "number": "rule number or MTR/IPG section", "text": "relevant rule text" }
- "cardsAnalyzed": array of { "name": "card name", "oracleText": "oracle text" }

Do not include markdown fences. Only use rules and card text provided below.`;

export async function generateRuling(
  question: string,
  ruleChunks: RuleChunk[],
  cardOracleTexts: { name: string; oracleText: string }[],
  complexity: "simple" | "complex",
  format?: string
): Promise<RulingResponse> {
  const deepseek = getDeepSeek();
  const isComplex = complexity === "complex";
  const model = isComplex ? "deepseek-v4-pro" : "deepseek-v4-flash";
  const maxTokens = isComplex ? 8192 : 4096;

  const crChunks = ruleChunks.filter((c) =>
    ["comprehensive_rules", "glossary", "scryfall_ruling"].includes(c.source)
  );
  const tournamentChunks = ruleChunks.filter((c) =>
    ["tournament_rules", "infraction_procedure", "regular_rel"].includes(c.source)
  );

  let rulesContext = crChunks
    .map((c) => `[${c.sourceId}] ${c.content}`)
    .join("\n\n");

  if (tournamentChunks.length > 0) {
    rulesContext += "\n\nTournament Policy:\n" + tournamentChunks
      .map((c) => `[${c.source}:${c.sourceId}] ${c.content}`)
      .join("\n\n");
  }

  const cardContext =
    cardOracleTexts.length > 0
      ? "\n\nCards:\n" +
        cardOracleTexts.map((c) => `- ${c.name}: ${c.oracleText}`).join("\n")
      : "";

  const formatContext = format ? `\n\nFormat: ${format}` : "";

  const result = await deepseek.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Question: ${question}${formatContext}\n\nRelevant Rules:\n${rulesContext}${cardContext}`,
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
