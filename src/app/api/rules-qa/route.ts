import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getDeepSeek } from "@/lib/deepseek/client";

interface RulesRequest {
  question: string;
  context?: string;
}

interface Rule {
  id: string;
  text: string;
}

interface Subsection {
  num: string;
  title: string;
  rules: Rule[];
}

interface Section {
  num: string;
  title: string;
  subsections: Subsection[];
}

interface GlossaryEntry {
  term: string;
  definition: string;
}

interface RulesData {
  sections: Section[];
  glossary: GlossaryEntry[];
}

let cachedRules: RulesData | null = null;

async function loadRules(): Promise<RulesData> {
  if (cachedRules) return cachedRules;
  const filePath = join(process.cwd(), "public", "rules.json");
  const raw = await readFile(filePath, "utf-8");
  cachedRules = JSON.parse(raw);
  return cachedRules!;
}

function findRelevantRules(rules: RulesData, question: string): string {
  const q = question.toLowerCase();
  const keywords = q
    .replace(/[?.,!'"]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "can", "does", "how", "what", "when", "why", "who", "are", "for", "with", "this", "that", "from", "have", "has"].includes(w));

  const scored: { text: string; score: number }[] = [];

  for (const section of rules.sections) {
    for (const subsec of section.subsections) {
      for (const rule of subsec.rules) {
        const ruleText = `${rule.id} ${rule.text}`.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (ruleText.includes(kw)) score++;
        }
        if (score > 0) {
          scored.push({
            text: `[${rule.id}] ${rule.text}`,
            score,
          });
        }
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topRules = scored.slice(0, 40).map((s) => s.text);

  const glossaryMatches: string[] = [];
  for (const entry of rules.glossary) {
    const entryText = `${entry.term} ${entry.definition}`.toLowerCase();
    if (keywords.some((kw) => entryText.includes(kw))) {
      glossaryMatches.push(`[Glossary: ${entry.term}] ${entry.definition}`);
    }
  }

  const glossaryTop = glossaryMatches.slice(0, 10);

  return [...topRules, ...glossaryTop].join("\n\n");
}

const SYSTEM_PROMPT = `You are an expert Magic: The Gathering rules advisor built into the MTG Houdini app. Your role is to answer rules questions accurately, clearly, and concisely.

INSTRUCTIONS:
- Answer the user's question about Magic: The Gathering rules
- Always cite specific Comprehensive Rules numbers (e.g., "Rule 702.2a") when applicable
- If the answer involves multiple rules, cite all relevant ones
- Explain in plain language first, then back it up with the rule citations
- If a question is ambiguous, address the most likely interpretation and note the ambiguity
- If the rules don't cover a specific scenario, say so clearly
- For tournament-level questions, note when a head judge ruling may apply
- Keep answers focused and practical — players want to resolve board states, not read essays

RESPONSE FORMAT (JSON):
{
  "answer": "Clear, plain-language answer to the question",
  "citations": [
    { "ruleId": "702.2a", "text": "Relevant rule text excerpt" }
  ],
  "relatedTerms": ["glossary terms that may help"],
  "confidence": "high" | "medium" | "low",
  "followUp": "Optional follow-up tip or common misconception about this topic"
}

Keep "answer" under 300 words. Include 1-5 citations. Only include "followUp" if genuinely useful.`;

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI rules advisor is not configured. Add DEEPSEEK_API_KEY to environment variables." }, { status: 503 });
  }

  const body: RulesRequest = await req.json();

  if (!body.question || body.question.trim().length < 3) {
    return NextResponse.json({ error: "Please ask a complete question" }, { status: 400 });
  }

  try {
    const rules = await loadRules();
    const relevantRules = findRelevantRules(rules, body.question);

    const deepseek = getDeepSeek();

    const userPrompt = `Here are the most relevant Comprehensive Rules sections for this question:

${relevantRules}

${body.context ? `Additional context from the user: ${body.context}\n` : ""}
USER QUESTION: ${body.question}`;

    const result = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rules analysis failed";
    console.error("Rules QA error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
