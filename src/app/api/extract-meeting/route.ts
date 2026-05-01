// POST /api/extract-meeting — turn a raw meeting transcript into a summary,
// list of decisions, and proposed action items.
//
// Tries Anthropic Claude first, then OpenAI, and finally falls back to a
// regex-based extractor when no API key is configured. The fallback is
// intentionally simple so the feature still works in offline / unconfigured
// environments — see extractWithRegex below.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ExtractedActionItem {
  title: string;
  assignedTo: string | null;
  dueDate: string | null;
}

interface ExtractionResult {
  summary: string;
  decisions: string[];
  actionItems: ExtractedActionItem[];
  source: "anthropic" | "openai" | "regex";
}

const KNOWN_MEMBERS = [
  "Courtney Mosely",
  "Aaliyah Thomas",
  "Raquel Twine",
  "Odessa Patterson",
  "Tiffany Stallworth",
  "Peggee",
];

export async function POST(req: NextRequest) {
  let body: { transcript?: string; members?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }
  if (transcript.length > 500_000) {
    return NextResponse.json({ error: "transcript too large (>500KB)" }, { status: 413 });
  }

  const members = Array.isArray(body.members) && body.members.length > 0 ? body.members : KNOWN_MEMBERS;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    if (anthropicKey) {
      const result = await extractWithAnthropic(transcript, members, anthropicKey);
      return NextResponse.json(result);
    }
    if (openaiKey) {
      const result = await extractWithOpenAI(transcript, members, openaiKey);
      return NextResponse.json(result);
    }
    const result = extractWithRegex(transcript, members);
    return NextResponse.json({ ...result, note: "No AI API key configured — using regex fallback. Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable AI extraction." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "extraction failed";
    // Fall back to regex if AI provider blew up — still useful output.
    const fallback = extractWithRegex(transcript, members);
    return NextResponse.json({ ...fallback, note: `AI extraction failed (${message}); fell back to regex.` });
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function extractWithAnthropic(
  transcript: string,
  members: string[],
  apiKey: string,
): Promise<ExtractionResult> {
  const prompt = buildPrompt(transcript, members);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((c: { text?: string }) => c?.text ?? "").join("\n")
    : "";
  const parsed = parseModelJSON(text);
  return { ...parsed, source: "anthropic" };
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function extractWithOpenAI(
  transcript: string,
  members: string[],
  apiKey: string,
): Promise<ExtractionResult> {
  const prompt = buildPrompt(transcript, members);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const parsed = parseModelJSON(text);
  return { ...parsed, source: "openai" };
}

function buildPrompt(transcript: string, members: string[]): string {
  return [
    "You are extracting structured meeting notes from a raw transcript.",
    "",
    `Known team members: ${members.join(", ")}.`,
    "When you assign an action item, prefer one of these names verbatim, or null if unclear.",
    "Dates must be ISO (YYYY-MM-DD) when mentioned, otherwise null.",
    "",
    "Return ONLY a JSON object matching this shape (no prose, no code fences):",
    `{`,
    `  "summary": "string — 3 to 5 short bullet points joined by newlines, each line starting with '• '",`,
    `  "decisions": ["string", ...],`,
    `  "actionItems": [{ "title": "string", "assignedTo": "string|null", "dueDate": "YYYY-MM-DD|null" }]`,
    `}`,
    "",
    "Transcript:",
    "---",
    transcript,
    "---",
  ].join("\n");
}

function parseModelJSON(raw: string): Omit<ExtractionResult, "source"> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  let obj: unknown;
  try {
    obj = JSON.parse(slice);
  } catch {
    throw new Error("Model did not return valid JSON");
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary : "";
  const decisions = Array.isArray(o.decisions)
    ? o.decisions.map(String).filter(Boolean)
    : [];
  const rawItems = Array.isArray(o.actionItems) ? o.actionItems : [];
  const actionItems = rawItems
    .map((item): ExtractedActionItem | null => {
      if (!item || typeof item !== "object") return null;
      const it = item as Record<string, unknown>;
      const title = typeof it.title === "string" ? it.title.trim() : "";
      if (!title) return null;
      const assignedTo = typeof it.assignedTo === "string" && it.assignedTo.trim() ? it.assignedTo.trim() : null;
      const dueDateRaw = typeof it.dueDate === "string" ? it.dueDate.trim() : "";
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : null;
      return { title, assignedTo, dueDate };
    })
    .filter((x): x is ExtractedActionItem => x !== null);
  return { summary, decisions, actionItems };
}

// ---------------------------------------------------------------------------
// Regex fallback
// ---------------------------------------------------------------------------

function extractWithRegex(transcript: string, members: string[]): ExtractionResult {
  const cleaned = stripTimecodes(transcript);
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Speaker-turn summary — first sentence of each speaker turn, deduped.
  const turns = collectSpeakerTurns(lines);
  const summarySentences: string[] = [];
  const seen = new Set<string>();
  for (const turn of turns) {
    const sent = firstSentence(turn.text);
    if (!sent) continue;
    const key = sent.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    summarySentences.push(sent);
    if (summarySentences.length >= 5) break;
  }
  if (summarySentences.length === 0) {
    // No detected speakers — fall back to first 5 sentences of body.
    const sentences = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    for (const s of sentences.slice(0, 5)) summarySentences.push(s);
  }
  const summary = summarySentences.map(s => `• ${s}`).join("\n");

  // Decisions — lines that look like a decision was made.
  const decisionPatterns = [
    /\bdecided\b/i,
    /\bwe (?:will|are going to)\b/i,
    /\bagreed\b/i,
    /\bvote(?:d)?\b/i,
    /\bresolved\b/i,
    /\bconsensus\b/i,
  ];
  const decisions: string[] = [];
  for (const line of lines) {
    const text = stripSpeaker(line);
    if (!text || text.length < 10) continue;
    if (decisionPatterns.some(p => p.test(text))) {
      const sentence = firstSentence(text);
      if (sentence && !decisions.includes(sentence)) decisions.push(sentence);
    }
    if (decisions.length >= 8) break;
  }

  // Action items.
  const actionItems: ExtractedActionItem[] = [];
  const actionPatterns = [
    /\baction item\b/i,
    /\bTODO\b/,
    /\bfollow[\s-]?up\b/i,
    /\bwill (?:do|send|draft|share|send out|prepare|circulate|review)\b/i,
    /\bneed(?:s)? to\b/i,
    /\bowes?\b/i,
  ];
  for (const line of lines) {
    const text = stripSpeaker(line);
    if (!text || text.length < 8) continue;
    const isAction = actionPatterns.some(p => p.test(text)) || matchNameTo(text, members);
    if (!isAction) continue;
    const item = parseActionLine(text, members);
    if (item && !actionItems.some(a => a.title.toLowerCase() === item.title.toLowerCase())) {
      actionItems.push(item);
    }
    if (actionItems.length >= 12) break;
  }

  return { summary, decisions, actionItems, source: "regex" };
}

function stripTimecodes(transcript: string): string {
  // Strip WebVTT cue blocks and SRT indices/timecodes.
  return transcript
    .replace(/^WEBVTT.*$/im, "")
    .replace(/^\d+\s*$/gm, "") // SRT cue numbers
    .replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, "")
    .replace(/^\d{2}:\d{2}:\d{2}\s*-->\s*\d{2}:\d{2}:\d{2}.*$/gm, "")
    .replace(/<\/?[^>]+>/g, "");
}

function collectSpeakerTurns(lines: string[]): { speaker: string | null; text: string }[] {
  const turns: { speaker: string | null; text: string }[] = [];
  let current: { speaker: string | null; text: string } | null = null;
  const speakerLine = /^([A-Z][A-Za-z'.\-]+(?:\s+[A-Z][A-Za-z'.\-]+){0,3})\s*[:\-]\s*(.+)$/;
  for (const line of lines) {
    const m = line.match(speakerLine);
    if (m) {
      if (current) turns.push(current);
      current = { speaker: m[1], text: m[2] };
    } else if (current) {
      current.text += " " + line;
    } else {
      current = { speaker: null, text: line };
    }
  }
  if (current) turns.push(current);
  return turns;
}

function stripSpeaker(line: string): string {
  const m = line.match(/^([A-Z][A-Za-z'.\-]+(?:\s+[A-Z][A-Za-z'.\-]+){0,3})\s*[:\-]\s*(.+)$/);
  return m ? m[2] : line;
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?\n]{1,300}[.!?]?/);
  return (m ? m[0] : text).trim();
}

function matchNameTo(text: string, members: string[]): string | null {
  // "[Name] to [verb] ..." or "[Name] will ..."
  for (const m of members) {
    const first = m.split(/\s+/)[0];
    const re = new RegExp(`\\b(${escapeRegex(m)}|${escapeRegex(first)})\\s+(?:to|will|should|is going to|needs? to)\\b`, "i");
    if (re.test(text)) return m;
  }
  return null;
}

function parseActionLine(text: string, members: string[]): ExtractedActionItem | null {
  const assignedTo = matchNameTo(text, members) ?? findAnyMember(text, members);
  const dueDate = parseDueDate(text);
  let title = text.replace(/^[\-\*•]\s*/, "").trim();
  title = title.replace(/^\b(action item|TODO|follow[\s-]?up)\s*[:\-]?\s*/i, "");
  if (title.length > 200) title = title.slice(0, 197) + "…";
  if (!title) return null;
  return { title, assignedTo, dueDate };
}

function findAnyMember(text: string, members: string[]): string | null {
  for (const m of members) {
    const first = m.split(/\s+/)[0];
    const re = new RegExp(`\\b(${escapeRegex(m)}|${escapeRegex(first)})\\b`);
    if (re.test(text)) return m;
  }
  return null;
}

function parseDueDate(text: string): string | null {
  // ISO date already?
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // "by Friday", "by next Monday"
  const byDay = text.match(/\bby\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (byDay) return nextWeekday(byDay[1]);

  // "by January 5", "by Jan 5, 2026"
  const byMonth = text.match(/\bby\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
  if (byMonth) {
    const monthIdx = monthToIdx(byMonth[1]);
    const day = parseInt(byMonth[2], 10);
    const year = byMonth[3] ? parseInt(byMonth[3], 10) : guessYear(monthIdx, day);
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function nextWeekday(name: string): string {
  const idx = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"].indexOf(name.toLowerCase());
  if (idx < 0) return "";
  const today = new Date();
  const diff = (idx - today.getDay() + 7) % 7 || 7;
  const target = new Date(today.getTime() + diff * 86400000);
  return target.toISOString().slice(0, 10);
}

function monthToIdx(name: string): number {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  return months.indexOf(name.slice(0, 3).toLowerCase());
}

function guessYear(monthIdx: number, day: number): number {
  const today = new Date();
  const candidate = new Date(today.getFullYear(), monthIdx, day);
  if (candidate.getTime() < today.getTime() - 86400000 * 7) return today.getFullYear() + 1;
  return today.getFullYear();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
