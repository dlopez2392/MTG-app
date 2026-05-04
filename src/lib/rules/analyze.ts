import { getDeepSeek } from "@/lib/deepseek/client";

export interface AnalysisResult {
  ruleAreas: string[];
  specificRules: string[];
  complexity: "simple" | "complex";
  cardsReferenced: string[];
}

const SYSTEM_PROMPT = `You are an MTG rules classification assistant. Given a rules question and optional card oracle texts, analyze the question and return JSON with these fields:

- "ruleAreas": array of relevant rule areas (e.g. "combat", "stack", "triggered abilities", "state-based actions", "layers", "replacement effects")
- "specificRules": array of specific rule numbers if identifiable (e.g. "702.1", "104.3a"). Only include if you are confident.
- "complexity": "simple" for straightforward single-rule questions, "complex" for multi-step interactions, layering, replacement effects, or unusual corner cases
- "cardsReferenced": array of card names mentioned or implied in the question that are NOT already provided in the card context

Return ONLY valid JSON, no markdown fences.`;

export async function analyzeQuestion(
  question: string,
  cardOracleTexts: { name: string; oracleText: string }[]
): Promise<AnalysisResult> {
  const deepseek = getDeepSeek();

  const cardContext =
    cardOracleTexts.length > 0
      ? "\n\nCards provided:\n" +
        cardOracleTexts.map((c) => `- ${c.name}: ${c.oracleText}`).join("\n")
      : "";

  const result = await deepseek.chat.completions.create({
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Question: ${question}${cardContext}` },
    ],
    temperature: 0.1,
    max_tokens: 512,
    response_format: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    ruleAreas: parsed.ruleAreas ?? parsed.rule_areas ?? [],
    specificRules: parsed.specificRules ?? parsed.specific_rules ?? [],
    complexity: parsed.complexity === "complex" ? "complex" : "simple",
    cardsReferenced: parsed.cardsReferenced ?? parsed.cards_referenced ?? [],
  };
}
