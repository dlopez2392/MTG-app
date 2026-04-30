"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import TopBar from "@/components/layout/TopBar";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-accent/30 text-accent rounded px-0.5">{p}</mark>
          : p
      )}
    </>
  );
}

function isSubrule(id: string) {
  return /\d{3}\.\d+[a-z]$/.test(id);
}

// ── TOC entry ────────────────────────────────────────────────────────────────

function TocSection({
  section,
  active,
  activeSubsec,
  onSelect,
  onSelectSubsec,
}: {
  section: Section;
  active: boolean;
  activeSubsec: string | null;
  onSelect: () => void;
  onSelectSubsec: (num: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onSelect}
        className={`w-full text-left px-3 py-2 text-sm font-bold transition-colors rounded-lg ${
          active
            ? "text-accent bg-accent/10"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        }`}
      >
        {section.num}. {section.title}
      </button>
      {active && (
        <div className="ml-2 mt-0.5 space-y-0.5">
          {section.subsections.map((sub) => (
            <button
              key={sub.num}
              onClick={() => onSelectSubsec(sub.num)}
              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeSubsec === sub.num
                  ? "text-accent bg-accent/10 font-medium"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {sub.num}. {sub.title}
            </button>
          ))}
          <button
            onClick={() => onSelectSubsec(`${section.num}-glossary`)}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
              activeSubsec === `${section.num}-glossary`
                ? "text-accent bg-accent/10 font-medium"
                : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            Glossary
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface QAResponse {
  answer: string;
  citations: { ruleId: string; text: string }[];
  relatedTerms?: string[];
  confidence?: "high" | "medium" | "low";
  followUp?: string;
}

export default function RulesPageClient() {
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string>("1");
  const [activeSubsec, setActiveSubsec] = useState<string | null>("100");
  const [showToc, setShowToc] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Q&A state
  const [showQA, setShowQA] = useState(false);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState<QAResponse | null>(null);
  const [qaError, setQaError] = useState("");
  const qaInputRef = useRef<HTMLInputElement>(null);

  const askQuestion = useCallback(async () => {
    if (!qaQuestion.trim() || qaLoading) return;
    setQaLoading(true);
    setQaError("");
    setQaResponse(null);
    try {
      const res = await fetch("/api/rules-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: qaQuestion.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get answer");
      setQaResponse(json);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setQaLoading(false);
    }
  }, [qaQuestion, qaLoading]);

  // Load rules JSON
  useEffect(() => {
    fetch("/rules.json")
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((d: RulesData) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load rules. Please refresh the page."); setLoading(false); });
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Scroll content to top when section changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeSection, activeSubsec]);

  const handleSelectSection = useCallback((num: string) => {
    setActiveSection(num);
    setActiveSubsec(null);
    setShowToc(false);
  }, []);

  const handleSelectSubsec = useCallback((num: string) => {
    setActiveSubsec(num);
    setShowToc(false);
  }, []);

  // Current content to display
  const currentSection = useMemo(
    () => data?.sections.find((s) => s.num === activeSection) ?? null,
    [data, activeSection]
  );

  const currentSubsec = useMemo(() => {
    if (!activeSubsec || !currentSection) return null;
    return currentSection.subsections.find((s) => s.num === activeSubsec) ?? null;
  }, [currentSection, activeSubsec]);

  const showGlossary = activeSubsec?.endsWith("-glossary") ?? false;

  // Flat search index — built once when data loads
  const searchIndex = useMemo(() => {
    if (!data) return null;
    const entries = data.sections.flatMap((section) =>
      section.subsections.flatMap((subsec) =>
        subsec.rules.map((rule) => ({
          sectionNum: section.num,
          sectionTitle: section.title,
          subsecNum: subsec.num,
          subsecTitle: subsec.title,
          rule,
          searchText: `${rule.id} ${rule.text}`.toLowerCase(),
        }))
      )
    );
    const glossary = data.glossary.map((g) => ({
      ...g,
      searchText: `${g.term} ${g.definition}`.toLowerCase(),
    }));
    return { entries, glossary };
  }, [data]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchIndex || !debouncedSearch.trim()) return null;
    const q = debouncedSearch.toLowerCase();

    const rules: Array<{ sectionNum: string; sectionTitle: string; subsecNum: string; subsecTitle: string; rule: Rule }> = [];
    for (const entry of searchIndex.entries) {
      if (entry.searchText.includes(q)) {
        rules.push(entry);
        if (rules.length >= 60) break;
      }
    }

    const glossary = searchIndex.glossary
      .filter((g) => g.searchText.includes(q))
      .slice(0, 20);

    return { rules, glossary };
  }, [searchIndex, debouncedSearch]);

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <TopBar title="Comprehensive Rules" showBack />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading rules…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <TopBar title="Comprehensive Rules" showBack />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-banned text-center">{error || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 64px)" }}>
      <TopBar
        title="Comprehensive Rules"
        showBack
        rightContent={
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowQA(!showQA); if (!showQA) setTimeout(() => qaInputRef.current?.focus(), 100); }}
              className={`p-1.5 transition-colors ${showQA ? "text-accent" : "text-text-secondary hover:text-text-primary"}`}
              aria-label="Ask AI"
              title="Ask a rules question"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </button>
            <button
              onClick={() => setShowToc(!showToc)}
              className="md:hidden p-1.5 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Table of contents"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
        }
      />

      {/* Search bar */}
      <div className="px-4 py-2.5 border-b border-border bg-bg-secondary/80 backdrop-blur">
        <div className="relative max-w-2xl mx-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules and glossary…"
            className="w-full input-base pl-10 pr-10 py-2"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── AI Rules Q&A Panel ── */}
      {showQA && (
        <div
          className="border-b border-accent/20 px-4 py-3"
          style={{ background: "linear-gradient(135deg, rgba(124,92,252,0.06), rgba(124,92,252,0.02))" }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI Rules Advisor</span>
            </div>

            <div className="flex gap-2">
              <input
                ref={qaInputRef}
                type="text"
                value={qaQuestion}
                onChange={(e) => setQaQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") askQuestion(); }}
                placeholder="Ask a rules question… e.g. 'Does protection prevent board wipes?'"
                className="input-base flex-1 py-2 text-sm"
                disabled={qaLoading}
              />
              <button
                onClick={askQuestion}
                disabled={qaLoading || !qaQuestion.trim()}
                className="px-4 py-2 rounded-xl btn-gradient text-sm font-bold disabled:opacity-40 flex-shrink-0"
              >
                {qaLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Ask"
                )}
              </button>
            </div>

            {/* Quick question chips */}
            {!qaResponse && !qaLoading && !qaError && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  "How does the stack work?",
                  "Can I respond to a split second spell?",
                  "How does trample + deathtouch work?",
                  "What happens if two state-based actions happen simultaneously?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setQaQuestion(q); }}
                    className="text-[11px] px-2 py-1 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {qaError && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-banned/10 border border-banned/20">
                <p className="text-xs text-banned">{qaError}</p>
              </div>
            )}

            {/* Loading */}
            {qaLoading && (
              <div className="mt-3 flex items-center gap-2 py-3">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-text-muted">Searching rules and analyzing…</span>
              </div>
            )}

            {/* Response */}
            {qaResponse && (
              <div className="mt-3 space-y-3">
                {/* Answer */}
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {qaResponse.confidence && (
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                        style={{
                          background: qaResponse.confidence === "high" ? "rgba(34,197,94,0.15)" : qaResponse.confidence === "medium" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                          color: qaResponse.confidence === "high" ? "#22C55E" : qaResponse.confidence === "medium" ? "#F59E0B" : "#EF4444",
                        }}
                      >
                        {qaResponse.confidence} confidence
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">{qaResponse.answer}</p>
                </div>

                {/* Citations */}
                {qaResponse.citations && qaResponse.citations.length > 0 && (
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1.5">Rule Citations</p>
                    <div className="space-y-1">
                      {qaResponse.citations.map((cite, i) => (
                        <div
                          key={i}
                          className="rounded-lg px-3 py-2 flex items-start gap-2"
                          style={{ background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.12)" }}
                        >
                          <span className="text-xs font-bold text-accent flex-shrink-0 mt-0.5">{cite.ruleId}</span>
                          <span className="text-xs text-text-secondary leading-relaxed">{cite.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related terms */}
                {qaResponse.relatedTerms && qaResponse.relatedTerms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mr-1 self-center">Related:</span>
                    {qaResponse.relatedTerms.map((term) => (
                      <button
                        key={term}
                        onClick={() => { setShowQA(false); setSearch(term); }}
                        className="text-[11px] px-2 py-0.5 rounded-md text-accent/70 hover:text-accent hover:bg-accent/10 transition-colors"
                        style={{ background: "rgba(124,92,252,0.08)" }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                )}

                {/* Follow up */}
                {qaResponse.followUp && (
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
                    <p className="text-[10px] text-amber-400/70 uppercase tracking-wider font-semibold mb-0.5">Good to know</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{qaResponse.followUp}</p>
                  </div>
                )}

                {/* Ask another */}
                <button
                  onClick={() => { setQaResponse(null); setQaQuestion(""); setTimeout(() => qaInputRef.current?.focus(), 50); }}
                  className="text-xs text-accent/60 hover:text-accent transition-colors"
                >
                  Ask another question
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* ── Mobile TOC drawer overlay ── */}
        {showToc && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setShowToc(false)}
          />
        )}

        {/* ── Table of Contents (sidebar) ── */}
        <aside
          className={`
            fixed md:relative inset-y-0 left-0 z-50 md:z-auto
            w-72 md:w-64 bg-bg-secondary border-r border-border
            flex flex-col transition-transform duration-200
            md:translate-x-0
            ${showToc ? "translate-x-0" : "-translate-x-full"}
          `}
          style={{ top: showToc ? 0 : undefined }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border md:hidden">
            <span className="text-sm font-bold text-text-primary">Table of Contents</span>
            <button onClick={() => setShowToc(false)} className="text-text-muted hover:text-text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="hidden md:block px-4 pt-3 pb-2 border-b border-border">
            <p className="text-xs font-bold text-text-muted tracking-widest uppercase">Table of Contents</p>
            <p className="text-[10px] text-text-muted mt-0.5">Effective Feb 27, 2026</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {data.sections.map((section) => (
              <TocSection
                key={section.num}
                section={section}
                active={activeSection === section.num}
                activeSubsec={activeSubsec}
                onSelect={() => handleSelectSection(section.num)}
                onSelectSubsec={handleSelectSubsec}
              />
            ))}
            {/* Glossary top-level */}
            <button
              onClick={() => { setActiveSection("glossary"); setActiveSubsec(null); setShowToc(false); }}
              className={`w-full text-left px-3 py-2 text-sm font-bold transition-colors rounded-lg ${
                activeSection === "glossary"
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              Glossary
            </button>
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto pb-24 md:pb-8"
        >
          <div className="max-w-2xl mx-auto px-4 py-4">

            {/* Search results */}
            {debouncedSearch.trim() && searchResults ? (
              <>
                <h2 className="text-lg font-bold text-text-primary mb-1">
                  Search Results
                </h2>
                <p className="text-xs text-text-muted mb-4">
                  {searchResults.rules.length} rule{searchResults.rules.length !== 1 ? "s" : ""}
                  {searchResults.glossary.length > 0 && ` · ${searchResults.glossary.length} glossary entries`}
                  {" "}matching &ldquo;{debouncedSearch}&rdquo;
                </p>

                {searchResults.rules.length === 0 && searchResults.glossary.length === 0 && (
                  <p className="text-sm text-text-muted py-8 text-center">No results found.</p>
                )}

                {searchResults.rules.map((r) => (
                  <button
                    key={r.rule.id}
                    onClick={() => { setActiveSection(r.sectionNum); setActiveSubsec(r.subsecNum); setSearch(""); }}
                    className="w-full text-left mb-3 p-3 bg-bg-card border border-border rounded-xl hover:border-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-accent">{r.rule.id}</span>
                      <span className="text-xs text-text-muted">{r.subsecNum}. {r.subsecTitle}</span>
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {highlight(r.rule.text.slice(0, 300) + (r.rule.text.length > 300 ? "…" : ""), debouncedSearch)}
                    </p>
                  </button>
                ))}

                {searchResults.glossary.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-text-secondary mt-6 mb-3 uppercase tracking-wider">Glossary</h3>
                    {searchResults.glossary.map((g) => (
                      <div key={g.term} className="mb-3 p-3 bg-bg-card border border-border rounded-xl">
                        <p className="text-sm font-bold text-accent mb-1">{highlight(g.term, debouncedSearch)}</p>
                        <p className="text-sm text-text-primary leading-relaxed">{highlight(g.definition, debouncedSearch)}</p>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : activeSection === "glossary" ? (
              /* ── Glossary view ── */
              <>
                <h2 className="text-2xl font-black text-text-primary mb-1 font-display tracking-wide uppercase">
                  Glossary
                </h2>
                <p className="text-xs text-text-muted mb-6">{data.glossary.length} terms</p>
                <div className="space-y-3">
                  {data.glossary.map((g) => (
                    <div key={g.term} className="p-3 bg-bg-card border border-border rounded-xl">
                      <p className="text-sm font-bold text-accent mb-1">{g.term}</p>
                      <p className="text-sm text-text-primary leading-relaxed">{g.definition}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : currentSubsec ? (
              /* ── Subsection view ── */
              <>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
                  <span
                    className="hover:text-accent cursor-pointer transition-colors"
                    onClick={() => setActiveSubsec(null)}
                  >
                    {currentSection?.num}. {currentSection?.title}
                  </span>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-text-secondary">{currentSubsec.num}. {currentSubsec.title}</span>
                </div>

                <h2 className="text-xl font-black text-text-primary mb-5 font-display tracking-wide uppercase">
                  {currentSubsec.num}. {currentSubsec.title}
                </h2>

                <div className="space-y-1">
                  {currentSubsec.rules.map((rule) => (
                    <div
                      key={rule.id}
                      id={`rule-${rule.id}`}
                      className={`py-2 ${isSubrule(rule.id) ? "pl-5 border-l-2 border-border ml-2" : ""}`}
                    >
                      <span className="text-xs font-bold text-accent mr-2 select-all">{rule.id}</span>
                      <span className="text-sm text-text-primary leading-relaxed">{rule.text}</span>
                    </div>
                  ))}
                </div>

                {/* Next section nav */}
                {currentSection && (() => {
                  const idx = currentSection.subsections.findIndex((s) => s.num === currentSubsec.num);
                  const next = currentSection.subsections[idx + 1];
                  return next ? (
                    <button
                      onClick={() => setActiveSubsec(next.num)}
                      className="mt-8 w-full py-3 rounded-xl bg-bg-card border border-border hover:border-accent/40 transition-colors flex items-center justify-between px-4"
                    >
                      <span className="text-xs text-text-muted">Next</span>
                      <span className="text-sm font-medium text-text-primary">{next.num}. {next.title}</span>
                      <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : null;
                })()}
              </>
            ) : currentSection ? (
              /* ── Section overview ── */
              <>
                <h2 className="text-2xl font-black text-text-primary mb-1 font-display tracking-wide uppercase">
                  {currentSection.num}. {currentSection.title}
                </h2>
                <p className="text-xs text-text-muted mb-6">
                  {currentSection.subsections.length} subsection{currentSection.subsections.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-2">
                  {currentSection.subsections.map((sub) => (
                    <button
                      key={sub.num}
                      onClick={() => setActiveSubsec(sub.num)}
                      className="w-full text-left p-4 bg-bg-card border border-border rounded-xl hover:border-accent/40 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-accent">{sub.num}</span>
                          <p className="text-sm font-semibold text-text-primary mt-0.5">{sub.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{sub.rules.length} rules</p>
                        </div>
                        <svg className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
