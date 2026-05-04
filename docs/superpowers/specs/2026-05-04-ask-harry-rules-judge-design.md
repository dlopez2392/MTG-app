# Ask Harry — AI MTG Rules Judge

**Date:** 2026-05-04
**Status:** Approved
**Feature:** AI-powered Magic: The Gathering rules judge integrated into MTG Houdini

---

## Overview

"Ask Harry" is an AI rules judge that answers MTG rules questions with cited rule references and card-aware context. It uses a two-step retrieval RAG pipeline backed by Supabase pgvector, with DeepSeek Flash handling simple questions and DeepSeek Pro handling complex multi-card interactions.

The feature replaces the existing keyword-based `/api/rules-qa` route with semantic vector search over the Comprehensive Rules, Scryfall per-card rulings, and the CR glossary.

### Competitive Positioning

Main competitor is MTG Agents (mtg-agents.com), which uses multi-agent RAG. Ask Harry matches their accuracy through two-step retrieval while offering a killer differentiator: in-game integration within an actual game companion app (v2).

---

## Phased Rollout

### v1 — Core Rules Judge
- Supabase pgvector table + migration
- Ingest scripts (Comprehensive Rules, Scryfall rulings, glossary)
- `/api/rules-judge` route with two-step retrieval pipeline
- Complexity router (Flash for simple, Pro for complex)
- "Ask Harry" page with free-text input + card name autocomplete
- Bottom nav update (replace Collection with Ask Harry)
- Collection relocated to Home page feature card + Decks page tab
- Remove old `/api/rules-qa` route

### v2 — Life Counter Integration
- Judge icon on the life counter screen
- Slide-up panel with question input
- Auto-populates gameContext (format, player count, tracked counters)
- "Ask Harry about this" contextual shortcut

### v3 — Deep Integration + Eval
- Long-press any card name in the app -> "Ask Harry about this card"
- Scryfall rulings auto-refresh (weekly cron via Vercel Cron)
- Evaluation suite using RulesGuru Q&A dataset
- Thumbs up/down feedback analysis

---

## Data Layer

### Vector Store Table: `rules_embeddings`

Supabase pgvector table in the existing instance.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `source` | text | `comprehensive_rules`, `scryfall_ruling`, or `glossary` |
| `source_id` | text | Rule number (e.g., "614.1a") or Scryfall oracle_id |
| `title` | text | Section header or card name |
| `content` | text | The actual rule text or ruling text |
| `embedding` | vector(1536) | HNSW-indexed embedding |
| `metadata` | jsonb | Rule chapter, card name, published date, etc. |
| `updated_at` | timestamptz | Last upsert timestamp |

Index: HNSW on `embedding` column for fast approximate nearest neighbor search.
Unique constraint on `(source, source_id)` for idempotent upserts.

### Data Sources

1. **Comprehensive Rules** (~2,500 rule sections) — fetched from Academy Ruins API (`api.academyruins.com`) as structured JSON. Chunked by individual rule number. Each rule (e.g., 614.1, 614.1a) gets its own row.

2. **Scryfall Rulings** (~100k+ rulings) — bulk download from Scryfall. One row per ruling, linked to card oracle_id.

3. **Glossary** (~400 terms) — from the CR glossary section, each term as its own row.

### Embedding Model

Decision during implementation: check if DeepSeek offers an embedding endpoint. If yes, use it (one provider). If no, use OpenAI `text-embedding-3-small` (1536 dimensions, $0.02/1M tokens). The vector dimension (1536) is set for OpenAI compatibility — if DeepSeek embeddings use a different dimension, update the migration accordingly.

### Ingest Scripts

- `scripts/ingest-rules.mjs` — fetches CR from Academy Ruins API, chunks by rule number, embeds, upserts into `rules_embeddings`
- `scripts/ingest-rulings.mjs` — fetches Scryfall bulk rulings, embeds, upserts

Both scripts are idempotent (upsert on `source` + `source_id`).

### Data Refresh Strategy (Hybrid)

- **Comprehensive Rules:** Manual refresh via ingest script when new sets release (~4-5x/year). Same workflow as `card-hashes.json` updates.
- **Scryfall Rulings:** Auto-refresh weekly (v3 — Vercel Cron). Manual via script until then.

---

## Two-Step Retrieval Pipeline

### Step 1 — Analyze (DeepSeek Flash)

Lightweight call to classify the question and identify relevant rules areas.

**Input:** Raw question + oracle text of any named cards (fetched from Scryfall).

**Output (JSON):**
```json
{
  "rule_areas": ["triggered abilities", "replacement effects"],
  "specific_rules": ["614.1", "603.2"],
  "complexity": "simple | complex",
  "cards_referenced": ["Panharmonicon", "Solitude"]
}
```

- `rule_areas` drives the vector search queries
- `specific_rules` enables direct row lookups (no vector search needed)
- `complexity` routes to Flash (simple) or Pro (complex) in step 3
- `cards_referenced` catches card names from free-text that weren't entered in the card fields

Cost: ~200-500 tokens, <1s latency.

### Step 2 — Retrieve (Parallel)

Three parallel lookups using step 1 output:

1. **Vector search** — embed `rule_areas` as queries against `rules_embeddings`. Top 20 results, filtered by relevance threshold.
2. **Direct rule lookup** — if `specific_rules` contains rule numbers, fetch exact rows via `WHERE source_id IN (...)`. No vector search needed.
3. **Card rulings** — for each card in `cards_referenced`, query `rules_embeddings` where `source = 'scryfall_ruling'` and `source_id` matches the oracle_id.

Deduplicate and rank combined results. Cap at ~40 rule chunks to stay within token budget.

### Step 3 — Answer (Flash or Pro)

**System prompt:**
"You are Harry, an expert MTG rules judge. Answer using only the provided rules and card text. Cite specific rule numbers. If uncertain, say so."

**Context block:** Retrieved CR sections + card oracle text + card-specific rulings.

**User block:** Original question.

**Response format (JSON):**
```json
{
  "ruling": "Plain English answer",
  "confidence": "high | medium | low",
  "cited_rules": [
    { "number": "614.1", "text": "Rule text..." }
  ],
  "cards_analyzed": [
    { "name": "Panharmonicon", "oracleText": "If an artifact..." }
  ]
}
```

**Model selection:**
- `complexity = "simple"` -> `deepseek-v4-flash` (4096 max tokens)
- `complexity = "complex"` -> `deepseek-v4-pro` (8192 max tokens)

---

## API Route

### `POST /api/rules-judge`

Replaces existing `/api/rules-qa`.

**Auth:** Clerk `auth()` required.
**Rate limit:** 10 requests / 60s per user (key: `ai:{userId}`).

**Request:**
```json
{
  "question": "string (max 2000 chars)",
  "cards": ["string"] ,
  "gameContext": {
    "format": "string",
    "playerCount": "number",
    "counters": "object"
  }
}
```

- `cards`: optional, max 5 card names
- `gameContext`: optional, auto-populated in v2 from life counter

**Response:**
```json
{
  "ruling": "string",
  "confidence": "high | medium | low",
  "citedRules": [{ "number": "string", "text": "string" }],
  "cardsAnalyzed": [{ "name": "string", "oracleText": "string" }],
  "model": "flash | pro"
}
```

**Error responses:** Same pattern as existing AI routes (401, 429, 502, 503).

---

## Frontend

### Ask Harry Page (`/app/ask-harry/page.tsx`)

**Header:** "Ask Harry" with tagline "Your AI rules judge — ask anything about MTG rules and card interactions"

**Input area:**
- Text field for the question (2000 char max)
- Optional card name chips with Scryfall autocomplete (reuses existing search component)
- Max 5 cards
- "Ask Harry" submit button

**Results area:**
- Harry's ruling in a styled card
- Confidence badge (green = high, yellow = medium, red = low)
- Expandable "Cited Rules" section showing rule numbers + text
- Expandable "Cards Analyzed" showing oracle text used
- Model indicator (flash/pro) for transparency
- "Was this helpful?" thumbs up/down (stores to localStorage for v3 eval)

**Recent questions:** Last 5 questions stored in localStorage for quick re-ask.

### Bottom Nav Update

**Before:** Home | Decks | Life | Collection | Settings
**After:** Home | Decks | Life | Ask Harry | Settings

Icon: gavel, scroll, or wizard hat (decided during implementation).

### Collection Relocation

Collection is accessible from two places:
1. **Home page** — feature card in the features grid, links to `/collection`
2. **Decks page** — new tab alongside "My Decks" and "Explore" (three-tab layout: My Decks | Explore | Collection)

---

## Technical Notes

### Dependencies on Existing Code
- Clerk auth pattern (all AI routes)
- Rate limiter (`src/lib/rateLimit.ts`)
- DeepSeek client (`src/lib/deepseek/client.ts`) — needs Pro model support added
- Scryfall proxy (`/api/scryfall/*`) — for card oracle text and autocomplete
- Supabase client (`src/lib/supabase/server.ts`)
- Banned cards data (`src/lib/data/bannedCards.ts`) — format-aware context

### New Infrastructure
- Supabase migration: `rules_embeddings` table with pgvector extension
- Two new ingest scripts in `scripts/`
- Embedding API integration (DeepSeek or OpenAI fallback)

### Migration Required
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rules_embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, source_id)
);

CREATE INDEX ON rules_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Token Budget per Request
- Step 1 (analyze): ~500 tokens
- Step 3 (answer): 4096 (Flash) or 8192 (Pro)
- Context window allocation: ~40 rule chunks * ~100 tokens each = ~4000 tokens of context
- Total per request: ~5000-13000 tokens depending on complexity
