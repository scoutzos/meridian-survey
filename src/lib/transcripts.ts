// Transcripts data layer — DB-backed meeting transcripts with Postgres
// full-text search. Stores the original file in Supabase Storage (bucket
// "transcripts") and extracted plain text in the `transcripts.body` column
// for search via the generated body_tsv tsvector.
//
// Why upload the original file too? Because plain-text extraction is lossy —
// timestamps, speaker labels, formatting all disappear. The original lets a
// reader open the formatted version when needed.

import { supabase } from "./supabase";

export interface Transcript {
  id: number;
  title: string;
  occurred_at: string | null;
  body: string | null;
  summary: string | null;
  action_items: string[];
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export const STORAGE_BUCKET = "transcripts";

/** List non-deleted transcripts, most recent first. */
export async function fetchTranscripts(): Promise<Transcript[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchTranscripts:", error); return []; }
  return (data as Transcript[]) ?? [];
}

/**
 * Full-text search across title (weight A), summary (B), body (C).
 * Uses Postgres `websearch_to_tsquery` so users can type natural queries
 * with quotes, OR, -word, etc.
 *
 * Empty query returns the same shape as fetchTranscripts.
 */
export async function searchTranscripts(query: string): Promise<Transcript[]> {
  const q = query.trim();
  if (!q) return fetchTranscripts();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .is("deleted_at", null)
    .textSearch("body_tsv", q, { type: "websearch", config: "english" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) { console.error("searchTranscripts:", error); return []; }
  return (data as Transcript[]) ?? [];
}

/** Read a File as plain text. For .txt files this is the body directly. */
async function readFileAsText(file: File): Promise<string> {
  return await file.text();
}

export interface UploadInput {
  file: File;
  title: string;
  occurredAt: string | null;     // ISO date or null
  uploader: string;
  sourceUrl?: string | null;
  summary?: string | null;
  /**
   * Optional override body. If the file is a .txt we extract automatically;
   * for non-text files (PDF/DOCX) the caller is responsible for parsing
   * client-side and passing the extracted text here.
   */
  bodyOverride?: string;
}

export interface UploadResult {
  transcript: Transcript | null;
  error: string | null;
  /** True if the original file was uploaded to Supabase Storage. False = file
   *  body persisted but original wasn't (e.g. bucket missing or upload failed). */
  fileStored: boolean;
}

/**
 * Upload a transcript: read text body, push original file to Storage, insert
 * row. Each step degrades gracefully — body always wins, file is best-effort.
 */
export async function uploadTranscript(input: UploadInput): Promise<UploadResult> {
  if (!supabase) return { transcript: null, error: "Supabase not configured", fileStored: false };
  const { file, title, occurredAt, uploader, sourceUrl, summary, bodyOverride } = input;

  // 1. Extract body. .txt → file.text(); other types need bodyOverride.
  let body = bodyOverride ?? "";
  if (!body && (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt"))) {
    try { body = await readFileAsText(file); }
    catch (e) { console.error("readFileAsText:", e); }
  }

  // 2. Upload original to Storage. Path is namespaced by year/month for sanity.
  const ts = new Date();
  const yyyy = ts.getUTCFullYear();
  const mm = String(ts.getUTCMonth() + 1).padStart(2, "0");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${yyyy}/${mm}/${ts.getTime()}-${safeName}`;

  let fileStored = false;
  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (uploadErr) {
    // Bucket likely doesn't exist yet — log and continue, body is still saved.
    console.warn("Storage upload failed (continuing with body-only):", uploadErr.message);
  } else {
    fileStored = true;
  }

  // 3. Insert row.
  const row = {
    title,
    occurred_at: occurredAt || null,
    body: body || null,
    summary: summary ?? null,
    source_url: sourceUrl ?? null,
    storage_path: fileStored ? storagePath : null,
    mime_type: file.type || null,
    uploaded_by: uploader,
    created_by: uploader,
    updated_by: uploader,
  };
  const { data, error } = await supabase.from("transcripts").insert(row).select().single();
  if (error) return { transcript: null, error: error.message, fileStored };
  return { transcript: data as Transcript, error: null, fileStored };
}

/** Soft-delete a transcript (sets deleted_at). Storage file is left in place
 *  for now — a reaper job can sweep orphans later. */
export async function deleteTranscript(id: number, actor: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("transcripts")
    .update({ deleted_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  return { error: error?.message ?? null };
}

/**
 * Build a signed URL for a stored transcript file. Returns null if the row
 * has no storage_path or the bucket fetch fails (which is fine — the body
 * text is still rendered in the UI).
 */
export async function transcriptDownloadUrl(t: Transcript, expiresInSec = 60 * 60): Promise<string | null> {
  if (!supabase || !t.storage_path) return null;
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(t.storage_path, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Highlight matching snippets in a body text for display. Returns up to
 * three short windows around the first matches. Naive substring scan —
 * good enough for a partnership tool.
 */
export function snippetsAround(body: string, query: string, maxSnippets = 3, windowChars = 120): string[] {
  if (!body || !query.trim()) return [];
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!tokens.length) return [];
  const lower = body.toLowerCase();
  const out: string[] = [];
  const seen = new Set<number>();
  for (const tok of tokens) {
    let idx = lower.indexOf(tok);
    while (idx !== -1 && out.length < maxSnippets) {
      const start = Math.max(0, idx - windowChars / 2);
      // Coalesce overlapping snippets.
      if (!Array.from(seen).some(s => Math.abs(s - start) < windowChars)) {
        seen.add(start);
        const end = Math.min(body.length, idx + tok.length + windowChars / 2);
        let s = body.slice(start, end).trim();
        if (start > 0) s = "…" + s;
        if (end < body.length) s = s + "…";
        out.push(s);
      }
      idx = lower.indexOf(tok, idx + tok.length);
    }
    if (out.length >= maxSnippets) break;
  }
  return out;
}
