"use client";

import { useState } from "react";
import { Panel, SectionTitle } from "../derivatives/ui";

type AskResponse = { provider: "gemini" | "openai"; answerText: string };
type AskError = { error: string; message?: string };

const SUGGESTED_QUESTIONS = [
  "Is geopolitical risk currently escalating or de-escalating?",
  "Which sanctions program has the most entities listed right now?",
  "Are any maritime chokepoints showing unusual traffic drops?",
  "Which tracked country has the largest recent military spending increase?",
];

export function AskGeopoliticsPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/geopolitical/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) {
        const b = body as AskError;
        if (res.status === 402 || b.error === "llm_quota_exceeded") {
          setError({ title: "AI provider is rate-limited or out of quota right now", detail: b.message || "Try again in a minute." });
        } else {
          setError({ title: "Question failed", detail: b.message || b.error || `HTTP ${res.status}` });
        }
        return;
      }
      setResult(body as AskResponse);
    } catch (e) {
      setError({ title: "Request failed", detail: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Ask Geopolitics</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          An LLM answers your question grounded strictly in the real/model-estimate numbers already shown on this page — it does not compute new numbers, does not have live intelligence, and is instructed to say plainly when something (classified capabilities, vessel-level tracking, election outcomes) isn&rsquo;t data this dashboard has. This is this project&rsquo;s fourth disclosed LLM-computed surface (see Sources &amp; Limitations), user-triggered only.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                ask(q);
              }}
              disabled={loading}
              className="rounded bg-panel-raised px-2 py-1 text-[11px] text-text-dim hover:text-text disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(question);
            }}
            placeholder="Ask a question about the data on this page…"
            maxLength={500}
            className="min-w-[280px] flex-1 rounded border border-border bg-panel-raised px-3 py-2 text-sm text-text"
          />
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-[#061018] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </Panel>

      {error && (
        <Panel className="border-l-4 border-l-[#e05a4d]">
          <p className="text-sm font-semibold text-text">{error.title}</p>
          <p className="mt-1 text-sm text-text-dim">{error.detail}</p>
        </Panel>
      )}

      {result && (
        <Panel>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-text-dim">
            Answered by {result.provider === "gemini" ? "Gemini" : "OpenAI"} — grounded in this page&rsquo;s data only
          </p>
          <p className="whitespace-pre-wrap text-sm text-text">{result.answerText}</p>
        </Panel>
      )}
    </div>
  );
}
