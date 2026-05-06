# AI-Powered MTG Rules Judge - Data Sources & Research

> Deep research completed 2026-05-04

---

## 1. MTG Comprehensive Rules - Official Document

### Official Sources
| Property | Value |
|---|---|
| **Official page** | https://magic.wizards.com/en/rules |
| **TXT download** | `https://media.wizards.com/2026/downloads/MagicCompRules%2020260227.txt` |
| **PDF download** | `https://media.wizards.com/2026/downloads/MagicCompRules%2020260227.pdf` |
| **URL pattern** | `media.wizards.com/{year}/downloads/MagicCompRules%20{YYYYMMDD}.{txt|pdf}` |
| **Formats** | TXT, PDF, DOCX |
| **Size** | ~292 pages (PDF), ~280K words. TXT ~24 MB bulk when processed |
| **Update cadence** | Every major set release (~4-5 times/year). Current: effective 2026-02-27 |
| **Structure** | Numbered rules (e.g. 100.1a), subrules skip "l" and "o" to avoid confusion with 1/0 |

### Machine-Readable / Structured Versions

**Academy Ruins API** (BEST OPTION for structured CR)
- GitHub: https://github.com/lunakv/academyruins-api
- Live API: `https://api.academyruins.com`
- Swagger docs: https://api.academyruins.com/docs
- Provides: CR, MTR, IPG as raw files AND structured JSON
- Includes diffs between versions, links to latest
- Latest release: v0.7.4 (Mar 2026) - actively maintained
- Key endpoints:
  - `/cr` - Full comprehensive rules as structured JSON (sections, subsections)
  - `/cr/{rule_number}` - Individual rule lookup
  - `/diff/cr` - Diffs between CR versions
  - `/file/mtr/{date}` - Tournament Rules by date
  - `/file/ipg/{date}` - Infraction Procedure Guide by date

**Yawgatog Hyperlinked Rules**
- URL: https://yawgatog.com/resources/magic-rules/
- HTML with all rule numbers and glossary terms cross-linked
- Rules changes history: https://yawgatog.com/resources/rules-changes/
- Not an API, but scrapeable HTML. Updated to current CR (April 2026)

**mtg.wtf Rules**
- URL: https://mtg.wtf/help/rules
- Searchable online version of comprehensive rules
- No public API

**MTG Wiki (Fandom)**
- URL: https://mtg.fandom.com/wiki/Comprehensive_Rules
- Has rules content + change history per set
- Scrapeable but not structured as API

---

## 2. Scryfall API - Rulings Data

### Rulings Endpoint
| Property | Value |
|---|---|
| **Base URL** | `https://api.scryfall.com` |
| **Endpoints** | `/cards/{id}/rulings`, `/cards/multiverse/{id}/rulings`, `/cards/{code}/{number}/rulings` |
| **Format** | JSON |
| **Fields** | `object` ("ruling"), `oracle_id` (UUID), `source` ("wotc" or "scryfall"), `published_at` (date), `comment` (text) |

### Rulings Data Properties
- Cards with same name share the same rulings set
- Sources: `wotc` (official WotC rulings/release notes) and `scryfall` (added by Scryfall team for context)
- If a card has rulings, it usually has more than one
- Very comprehensive: covers card-specific interactions, clarifications, errata

### Bulk Data Download
| File | URL Pattern | Size | Updated |
|---|---|---|---|
| **Rulings** | `https://data.scryfall.io/rulings/rulings-{timestamp}.json` | **23.9 MB** | Daily |
| Oracle Cards | `https://data.scryfall.io/oracle-cards/oracle-cards-{timestamp}.json` | 165 MB | Daily |
| Default Cards | `https://data.scryfall.io/default-cards/default-cards-{timestamp}.json` | 513 MB | Daily |
| All Cards | `https://data.scryfall.io/all-cards/all-cards-{timestamp}.json` | 2.34 GB | Daily |

Bulk data API: `https://scryfall.com/docs/api/bulk-data` - returns list of all bulk files with current download URLs.

### Rate Limits
| Endpoint | Limit |
|---|---|
| `/cards/search` | 2/second (500ms) |
| `/cards/named` | 2/second (500ms) |
| `/cards/random` | 2/second (500ms) |
| `/cards/collection` | 2/second (500ms) |
| All other methods | 10/second (100ms) |
| `*.scryfall.io` (bulk files) | **No rate limit** |

- HTTP 429 = 30-second access lockout. Repeated violations = temp/permanent ban
- Must cache locally for 24+ hours. Prices update once daily
- Bulk data regenerated every 12 hours

### Terms of Use
- Free under Wizards of the Coast Fan Content Policy
- For: creating MTG software, research, community content (videos, streams, podcasts)
- Must not be used to replicate Scryfall itself

---

## 3. MTGJSON - Alternative Card+Rulings Source

- URL: https://mtgjson.com
- Downloads: https://mtgjson.com/downloads/all-files/
- API base: `https://mtgjson.com/api/v5/`
- Formats: JSON, CSV, Parquet, SQLite database files
- **Rulings data model**: embedded per-card in AllPrintings
  - Fields: `date` (string), `text` (string)
- Updated daily (automated builds)
- AllPrintings.json includes all cards + all rulings per card
- Also available as SQLite DB file (great for local querying)

---

## 4. Other MTG Rules Resources

### Judge Academy
- URL: https://judgeacademy.com/mtg-documents/
- Hosts: Comprehensive Rules, MTR, IPG
- No public API, but documents are freely downloadable
- WPN rules documents: https://wpn.wizards.com/en/rules-documents

### RulesGuru
- URL: https://rulesguru.net (also https://rulesguru.org)
- GitHub: https://github.com/KingSupernova31/RulesGuru
- **1,487+ curated rules questions** with answers
- Supports procedural generation of question variations
- Searchable by difficulty, topic, format legality
- Has an **API** for building features on top of the question pool
- Open source - great for evaluation datasets and training data

### Stack Exchange - Board Games
- Tag: `magic-the-gathering` on boardgames.stackexchange.com
- Thousands of Q&A pairs about MTG rules
- **Full data dump available**: https://archive.org/details/stackexchange (quarterly, CC-BY-SA 4.0)
- Includes: Posts, Users, Votes, Comments, Tags in XML format
- Can filter for `magic-the-gathering` tagged questions
- Also accessible via Stack Exchange API: https://api.stackexchange.com/

### Commander Spellbook (already integrated in MTG Houdini)
- Backend API: `https://backend.commanderspellbook.com`
- Swagger: https://backend.commanderspellbook.com/schema/swagger/
- Key endpoints: `/variants/`, `/find-my-combos/`, `/cards/`, `/features/`
- Combo data includes: `prerequisites`, `steps`, `results` (natural language)
- **Does contain rules-relevant data**: combo prerequisites describe game state conditions and steps describe resolution order
- Not a rules database per se, but combo prerequisites/steps encode rules knowledge

### Magic Judges Blog / Official Resources
- URL: https://blogs.magicjudges.org/rules/cr/
- Comprehensive rules hosted in navigable format
- Official judge community resources

### TappedOut Rules Q&A
- URL: https://tappedout.net/mtg-questions/
- Community Q&A for rules questions
- Less structured than Stack Exchange

---

## 5. Existing AI Rules Judge Competitors

### MTG Agents (mtg-agents.com) - PRIMARY COMPETITOR
- URL: https://mtg-agents.com
- How it works: https://mtg-agents.com/how-it-works
- **Architecture**: Multi-agent system (Agentic RAG)
  - **Nissa agent**: Rules questions - searches CR, RulesGuru, Stack Exchange, Scryfall rulings
  - **Karn agent**: Deck building - hybrid vector search + keyword matching on card attributes
  - **Router agent**: Directs questions to correct specialist
- **Data sources**: Scryfall (40,000+ cards), Comprehensive Rules, RulesGuru, Stack Exchange
- Real-time tool use with transparency (shows which tools used)
- Has evaluation dataset: 45 questions spanning rules, card searches, guardrails
- Uses LLM-as-a-judge for accuracy evaluation
- Article on evaluation: https://medium.com/@fkrempl/evaluating-a-multi-agent-system-for-magic-the-gathering-rules-questions-d206044deef1

### MTG Judge (app.mtg-judge.com)
- URL: https://app.mtg-judge.com
- AI-powered rules clarifications and judge rulings
- Card search with comprehensive rules analysis
- Less technical detail available on architecture

### MTG JudgeBot (GitHub - RAG)
- GitHub: https://github.com/mtrevin93/mtg-judgebot
- RAG-based architecture
- Data: Scryfall Oracle text + rulings
- Files: `analyze_mtg_rules.py`, `card_processor.py`, agent tools in `app/api/chat/tools/`
- Uses Pinecone vector DB for embeddings

### Magic Judge RAG (GitHub)
- GitHub: https://github.com/manski117/magic-judge-rag
- Another RAG-based judgebot API
- LLM + embeddings approach

### ChatGPT Custom GPTs
- "Magic Judge" GPT: https://www.yeschat.ai/gpts-ZxX7du8G-Magic-Judge
- "Accurate Real-time MTG Judge" GPT: https://www.yeschat.ai/gpts-9t557MxBg2z-Accurate-Real-time-MTG-Judge
- "MTG Official Rulebook Bot" GPT: https://www.yeschat.ai/gpts-2OToA5jhiy-MTG-Official-Rulebook-Bot
- Multiple exist, varying quality, most just use CR as context file in GPT

### RulesLawyer Bot (Discord/Slack)
- GitHub: https://github.com/RulesLawyerBot/ruleslawyer
- Website: https://www.ruleslawyer.app
- Discord "Early Verified Bot" - widely used
- **Architecture**: NOT AI-based. Keyword search through rules documents
  - `ruleslawyer-rules-parser` - parses CR document
  - `ruleslawyer-scryfall-ingestion` - ingests Scryfall data
  - `ruleslawyer-core` - search engine backend
  - `ruleslawyer-discord` / `ruleslawyer-api` - frontends
- Platforms: Discord, Slack, Web, Android
- Searches: CR, MTR, IPG, card oracle text
- 114 commits, actively maintained

### Otterly MTG (Discord Bot)
- URL: https://top.gg/bot/1460038857427910861
- Card lookup, deck breakdown, rules questions
- Newer bot, less established

---

## 6. Key Technical Challenges for AI Rules Judge

### Layer System (CR Rules 613.x)
- 7 layers applied in specific order to determine continuous effects:
  1. Copy effects
  2. Control-changing effects
  3. Text-changing effects
  4. Type-changing effects
  5. Color-changing effects
  6. Ability-adding/removing effects
  7. Power/toughness-changing (sub-layers: 7a-7e)
- Within each layer: dependency ordering, then timestamp ordering
- Dependencies can create circular references requiring special handling
- **AI challenge**: Must track which effects are in which layer, apply them in order, handle dependencies

### State-Based Actions (CR Rules 704.x)
- Checked whenever a player would get priority
- All applicable SBAs performed simultaneously as single event
- If any SBA performed, re-check before any player gets priority
- Examples: creature with 0 or less toughness dies, player at 0 life loses, legend rule
- **AI challenge**: Must track all game state conditions simultaneously, apply them atomically

### Stack Interaction Rules (CR Rules 405.x, 601.x-603.x)
- Last-in-first-out resolution
- Priority passing between players
- Split second, cannot be countered, "as though they had flash"
- Mana abilities don't use the stack
- **AI challenge**: Must model priority correctly, handle special cases

### Replacement Effects vs Triggered Abilities (CR Rules 614.x-616.x)
- Replacement effects modify events before they happen (not using the stack)
- Triggered abilities go on stack after event
- Multiple replacement effects: affected player/controller chooses order
- Self-replacement effects apply first
- **AI challenge**: Must distinguish between these fundamentally different mechanisms

### Timestamp Ordering (CR Rules 613.7)
- Within a layer, effects applied in timestamp order
- Continuous effects from static abilities: timestamp = when permanent entered
- Continuous effects from resolving spells/abilities: timestamp = when resolved
- **AI challenge**: Must track timestamps for all continuous effects

### Additional Complexity Areas
- **Linked abilities**: abilities that refer to each other across zones
- **Characteristic-defining abilities**: applied in all zones, before other effects
- **Cost modification**: additional costs, alternative costs, cost reduction (ordering matters)
- **Targets and legality**: checked on cast AND on resolution
- **Zone changes**: objects become new objects when changing zones (with exceptions)
- **Commander-specific rules**: command zone, commander tax, color identity, partner

---

## 7. Recommended Data Architecture for MTG Rules Judge

### Tier 1 - Core Data (must have)
1. **Comprehensive Rules** via Academy Ruins API (structured JSON) - rules text
2. **Scryfall Bulk Rulings** (23.9 MB JSON, daily) - per-card rulings
3. **Scryfall Oracle Cards** (165 MB JSON, daily) - card oracle text, types, costs

### Tier 2 - Training/Evaluation Data
4. **RulesGuru questions** (1,487+ Q&A pairs via API) - evaluation dataset
5. **Stack Exchange data dump** (boardgames.stackexchange.com, CC-BY-SA) - thousands of MTG rules Q&A

### Tier 3 - Supplementary
6. **Commander Spellbook** (already integrated) - combo prerequisites encode rules knowledge
7. **MTGJSON AllPrintings** (SQLite) - alternative card+rulings source with additional metadata

### Recommended Approach
Based on competitor analysis, the **Agentic RAG** pattern (as used by MTG Agents) is the most proven:
1. Embed comprehensive rules into vector DB (chunked by rule section)
2. Embed per-card rulings from Scryfall
3. Give AI agent tools to: search rules, look up card rulings, search RulesGuru, look up specific cards
4. Use RulesGuru + Stack Exchange Q&A as evaluation dataset
5. LLM-as-a-judge for continuous quality monitoring

---

## Sources

- [Wizards Official Rules Page](https://magic.wizards.com/en/rules)
- [Scryfall API Docs](https://scryfall.com/docs/api)
- [Scryfall Rulings API](https://scryfall.com/docs/api/rulings)
- [Scryfall Bulk Data](https://scryfall.com/docs/api/bulk-data)
- [Scryfall Rate Limits](https://scryfall.com/docs/api/rate-limits)
- [Academy Ruins API](https://github.com/lunakv/academyruins-api)
- [MTGJSON](https://mtgjson.com)
- [RulesGuru](https://rulesguru.net)
- [RulesGuru GitHub](https://github.com/KingSupernova31/RulesGuru)
- [MTG Agents](https://mtg-agents.com/how-it-works)
- [MTG Agents Evaluation Article](https://medium.com/@fkrempl/evaluating-a-multi-agent-system-for-magic-the-gathering-rules-questions-d206044deef1)
- [RulesLawyer Bot](https://github.com/RulesLawyerBot/ruleslawyer)
- [MTG JudgeBot](https://github.com/mtrevin93/mtg-judgebot)
- [Magic Judge RAG](https://github.com/manski117/magic-judge-rag)
- [Commander Spellbook API](https://backend.commanderspellbook.com/schema/swagger/)
- [Yawgatog Hyperlinked Rules](https://yawgatog.com/resources/magic-rules/)
- [Judge Academy Documents](https://judgeacademy.com/mtg-documents/)
- [Stack Exchange Data Dump](https://archive.org/details/stackexchange)
- [MTG Wiki - Comprehensive Rules](https://mtg.fandom.com/wiki/Comprehensive_Rules)
- [MTG Wiki - Layers](https://mtg.fandom.com/wiki/Layer)
