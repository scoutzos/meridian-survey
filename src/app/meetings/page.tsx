"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import { isAdmin, type MemberProfile } from "@/lib/tracker";
import { createActionItem } from "@/lib/action-items";
import {
  createMeetingNote,
  deleteMeetingNote,
  fetchMeetingNotes,
  fetchNextMeeting,
  updateNextMeeting,
  type MeetingNote,
  type NextMeeting,
} from "@/lib/meetings";

const DISPLAY_FONT = "var(--font-display)";

type ExtractedActionItem = { title: string; assignedTo: string | null; dueDate: string | null };
type ExtractionResult = {
  summary: string;
  decisions: string[];
  actionItems: ExtractedActionItem[];
  source?: string;
  note?: string;
};

const ACCEPTED_TYPES = ".txt,.vtt,.srt,.docx";

function formatLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function MeetingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [next, setNext] = useState<NextMeeting | null>(null);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNext, setEditingNext] = useState(false);
  const [nextDraft, setNextDraft] = useState<{ meeting_date: string; meeting_time: string; agenda: string }>({
    meeting_date: "", meeting_time: "", agenda: "",
  });
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNote, setNewNote] = useState({
    meeting_date: "", agenda: "", notes: "", attendees: [] as string[],
  });

  // Transcript / extraction state.
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [transcriptFilename, setTranscriptFilename] = useState<string>("");
  const [parsingFile, setParsingFile] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [n, list] = await Promise.all([fetchNextMeeting(), fetchMeetingNotes()]);
    setNext(n);
    setNotes(list);
    if (n) setNextDraft({
      meeting_date: n.meeting_date ?? "",
      meeting_time: n.meeting_time ?? "",
      agenda: n.agenda ?? "",
    });
    if (supabase) {
      const { data } = await supabase.from("tracker_member_profiles").select("*");
      setProfiles((data as MemberProfile[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void reload();
  }, [router, reload]);

  if (!user) return null;
  const admin = isAdmin(profiles, user);

  const resetNewNoteForm = () => {
    setNewNote({ meeting_date: "", agenda: "", notes: "", attendees: [] });
    setTranscriptText("");
    setTranscriptFilename("");
    setExtraction(null);
    setConfirmedItems(new Set());
  };

  const saveNext = async () => {
    const { error } = await updateNextMeeting({
      meeting_date: nextDraft.meeting_date || null,
      meeting_time: nextDraft.meeting_time.trim() || null,
      agenda: nextDraft.agenda.trim() || null,
    }, user);
    if (error) { alert(error); return; }
    setEditingNext(false);
    void reload();
  };

  const saveNote = async () => {
    if (!newNote.meeting_date) { alert("Pick a meeting date."); return; }
    const { data, error } = await createMeetingNote({
      meeting_date: newNote.meeting_date,
      agenda: newNote.agenda,
      notes: newNote.notes,
      attendees: newNote.attendees,
      transcript: transcriptText || null,
      transcript_filename: transcriptFilename || null,
    }, user);
    if (error) { alert(error); return; }

    // Create any confirmed action items from the extraction.
    if (extraction && data) {
      const toCreate = extraction.actionItems.filter((_, i) => confirmedItems.has(i));
      for (const item of toCreate) {
        await createActionItem({
          title: item.title,
          description: `From meeting on ${formatLong(newNote.meeting_date)}.`,
          assigned_to: item.assignedTo,
          due_date: item.dueDate,
        }, user);
      }
    }

    resetNewNoteForm();
    setShowNewNote(false);
    void reload();
  };

  const removeNote = async (note: MeetingNote) => {
    if (!confirm(`Delete notes for ${formatLong(note.meeting_date)}?`)) return;
    const { error } = await deleteMeetingNote(note.id, user);
    if (error) { alert(error); return; }
    setNotes(prev => prev.filter(n => n.id !== note.id));
  };

  const toggleAttendee = (m: string) => {
    setNewNote(prev => ({
      ...prev,
      attendees: prev.attendees.includes(m) ? prev.attendees.filter(a => a !== m) : [...prev.attendees, m],
    }));
  };

  const handleFile = async (file: File) => {
    setParsingFile(true);
    setExtraction(null);
    setConfirmedItems(new Set());
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".docx")) {
        const text = await extractDocxText(file);
        setTranscriptText(text);
      } else {
        // .txt, .vtt, .srt — all plain text.
        const text = await file.text();
        setTranscriptText(text);
      }
      setTranscriptFilename(file.name);
    } catch (err) {
      alert(`Could not read file: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setParsingFile(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const runExtraction = async () => {
    if (!transcriptText.trim()) { alert("Upload a transcript first."); return; }
    setExtracting(true);
    setExtraction(null);
    try {
      const res = await fetch("/api/extract-meeting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText, members: MEMBERS }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Extraction failed");
        return;
      }
      const result = data as ExtractionResult;
      setExtraction(result);
      // All action items confirmed by default.
      setConfirmedItems(new Set(result.actionItems.map((_, i) => i)));
      // Auto-fill notes field with summary + decisions.
      const noteParts: string[] = [];
      if (result.summary) noteParts.push(result.summary);
      if (result.decisions.length > 0) {
        noteParts.push("\nDecisions:\n" + result.decisions.map(d => `• ${d}`).join("\n"));
      }
      if (noteParts.length > 0) setNewNote(prev => ({ ...prev, notes: noteParts.join("\n") }));
    } catch (err) {
      alert(`Extraction failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setExtracting(false);
    }
  };

  const toggleConfirm = (idx: number) => {
    setConfirmedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "84px 20px 100px" }} className="meetings-root">
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
          Cadence
        </p>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
          Meeting hub
        </h1>
        <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
          Standing Monday meeting at 7:15 PM ET. Agenda + notes archive below.
        </p>
      </header>

      {/* Upcoming meeting */}
      <section style={{ marginBottom: 32 }}>
        <div style={{
          background: "var(--obsidian)", color: "var(--bone)",
          borderRadius: 16, padding: "24px 26px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
                Next meeting
              </p>
              <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 30, fontWeight: 500, color: "var(--bone)", lineHeight: 1.1, marginBottom: 4 }}>
                {next?.meeting_date ? formatLong(next.meeting_date) : "Monday"}
              </h2>
              <p style={{ fontSize: 14, color: "var(--fog)" }}>
                {next?.meeting_time ?? "7:15 PM ET"}
              </p>
            </div>
            {admin && !editingNext && (
              <button
                onClick={() => setEditingNext(true)}
                style={{
                  background: "var(--brass)", color: "var(--obsidian)", border: "none", borderRadius: 6,
                  padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                Edit
              </button>
            )}
          </div>

          {editingNext ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="next-form-row">
                <input
                  type="date"
                  value={nextDraft.meeting_date}
                  onChange={e => setNextDraft({ ...nextDraft, meeting_date: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Time (e.g. 7:15 PM ET)"
                  value={nextDraft.meeting_time}
                  onChange={e => setNextDraft({ ...nextDraft, meeting_time: e.target.value })}
                />
              </div>
              <textarea
                rows={5}
                placeholder="Agenda…"
                value={nextDraft.agenda}
                onChange={e => setNextDraft({ ...nextDraft, agenda: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveNext} style={primaryBtn}>Save</button>
                <button onClick={() => setEditingNext(false)} style={subtleBtnDark}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--fog)", fontWeight: 600, marginBottom: 8 }}>
                Agenda
              </p>
              {next?.agenda ? (
                <pre style={{
                  fontFamily: "var(--font-body)", fontSize: 14, color: "var(--bone)", opacity: 0.9,
                  whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0,
                }}>
                  {next.agenda}
                </pre>
              ) : (
                <p style={{ fontSize: 13, color: "var(--fog)", opacity: 0.7 }}>No agenda set.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Past notes */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 500, color: "var(--obsidian)" }}>
            Past meetings
          </h2>
          {admin && (
            <button
              onClick={() => {
                if (showNewNote) resetNewNoteForm();
                setShowNewNote(s => !s);
              }}
              style={{
                background: showNewNote ? "transparent" : "var(--brass)",
                color: showNewNote ? "var(--brass)" : "var(--obsidian)",
                border: showNewNote ? "1px solid var(--brass)" : "none",
                borderRadius: 6, padding: "10px 16px", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              {showNewNote ? "Cancel" : "Log meeting"}
            </button>
          )}
        </div>

        {showNewNote && admin && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 12,
            padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={newNote.meeting_date}
                onChange={e => setNewNote({ ...newNote, meeting_date: e.target.value })}
              />
            </div>

            {/* Transcript upload zone */}
            <div>
              <label style={labelStyle}>Transcript (optional)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  background: "var(--bone)",
                  border: `1px ${dragOver ? "solid" : "dashed"} ${dragOver ? "var(--brass)" : "var(--fog)"}`,
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={onFileInputChange}
                  style={{ display: "none" }}
                />
                {parsingFile ? (
                  <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.75 }}>Reading file…</p>
                ) : transcriptFilename ? (
                  <div>
                    <p style={{ fontSize: 13, color: "var(--obsidian)", fontWeight: 600 }}>
                      {transcriptFilename}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--ink)", opacity: 0.6, marginTop: 4 }}>
                      {transcriptText.length.toLocaleString()} characters · click to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontFamily: DISPLAY_FONT, fontSize: 18, color: "var(--obsidian)", marginBottom: 4 }}>
                      Drop a transcript file here
                    </p>
                    <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.65 }}>
                      .txt · .vtt · .srt · .docx — or click to upload
                    </p>
                  </div>
                )}
              </div>

              {transcriptText && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={runExtraction}
                    disabled={extracting}
                    style={{ ...primaryBtn, opacity: extracting ? 0.6 : 1 }}
                  >
                    {extracting ? "Analyzing transcript…" : "Extract notes & actions"}
                  </button>
                  <button
                    onClick={() => { setTranscriptText(""); setTranscriptFilename(""); setExtraction(null); setConfirmedItems(new Set()); }}
                    style={subtleBtn}
                  >
                    Remove file
                  </button>
                </div>
              )}
            </div>

            {extraction && (
              <div style={{
                background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 10,
                padding: 14, display: "flex", flexDirection: "column", gap: 12,
              }}>
                <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600 }}>
                  AI extraction {extraction.source ? `· ${extraction.source}` : ""}
                </p>
                {extraction.note && (
                  <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                    {extraction.note}
                  </p>
                )}
                {extraction.actionItems.length > 0 ? (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--obsidian)", marginBottom: 8 }}>
                      Confirm action items to create ({confirmedItems.size}/{extraction.actionItems.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {extraction.actionItems.map((item, i) => (
                        <label
                          key={i}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "8px 10px", background: "var(--surface)",
                            border: "1px solid var(--fog)", borderRadius: 8, cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={confirmedItems.has(i)}
                            onChange={() => toggleConfirm(i)}
                            style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--brass)" }}
                          />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, color: "var(--ink)" }}>{item.title}</p>
                            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {item.assignedTo ? item.assignedTo : "Unassigned"}
                              {item.dueDate ? ` · due ${item.dueDate}` : ""}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>No action items detected.</p>
                )}
              </div>
            )}

            <textarea
              rows={2}
              placeholder="Agenda"
              value={newNote.agenda}
              onChange={e => setNewNote({ ...newNote, agenda: e.target.value })}
            />
            <textarea
              rows={6}
              placeholder="Notes (auto-filled from transcript when extracted)"
              value={newNote.notes}
              onChange={e => setNewNote({ ...newNote, notes: e.target.value })}
            />
            <div>
              <label style={labelStyle}>Attendees</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {MEMBERS.map(m => {
                  const on = newNote.attendees.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleAttendee(m)}
                      style={{
                        background: on ? "var(--brass)" : "transparent",
                        color: on ? "var(--obsidian)" : "var(--ink)",
                        border: on ? "1px solid var(--brass)" : "1px solid var(--fog)",
                        borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={saveNote} style={primaryBtn}>Save meeting</button>
            </div>
          </div>
        )}

        {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

        {!loading && notes.length === 0 && (
          <div style={{
            background: "var(--surface)", border: "1px dashed var(--fog)", borderRadius: 12,
            padding: 28, textAlign: "center", color: "var(--ink)", opacity: 0.6,
          }}>
            <p style={{ fontFamily: DISPLAY_FONT, fontSize: 22, marginBottom: 4, fontStyle: "italic" }}>
              No meeting notes yet
            </p>
            <p style={{ fontSize: 13 }}>Past agendas and decisions will live here.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notes.map(n => (
            <article key={n.id} style={{
              background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 12,
              padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 500, color: "var(--obsidian)" }}>
                  {formatLong(n.meeting_date)}
                </h3>
                {admin && (
                  <button onClick={() => removeNote(n)} style={subtleBtn}>Delete</button>
                )}
              </div>
              {n.attendees && n.attendees.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {n.attendees.map(a => (
                    <span key={a} style={{
                      fontSize: 11, color: "var(--ink)", opacity: 0.75,
                      background: "var(--bone)", border: "1px solid var(--fog)",
                      padding: "2px 8px", borderRadius: 999,
                    }}>
                      {a}
                    </span>
                  ))}
                </div>
              )}
              {n.agenda && (
                <div>
                  <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 4 }}>
                    Agenda
                  </p>
                  <pre style={preStyle}>{n.agenda}</pre>
                </div>
              )}
              {n.notes && (
                <div>
                  <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 4 }}>
                    Notes
                  </p>
                  <pre style={preStyle}>{n.notes}</pre>
                </div>
              )}
              {n.transcript_filename && (
                <p style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                  Transcript on file: {n.transcript_filename}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 600px) {
          .meetings-root { padding-top: 28px !important; }
          :global(.next-form-row) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// .docx is a zip with word/document.xml inside. Pull text content directly in
// the browser so we don't need a server round-trip just to read the file.
async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const xml = await readDocxXml(new Uint8Array(buf));
  if (!xml) return "";
  // Grab all <w:t>…</w:t> runs and join them with spaces. Paragraph breaks
  // come from <w:p> separators — convert those to newlines first.
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br\s*\/?>/g, "\n");
  const matches = withBreaks.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
  const text = matches
    .map(m => m.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  // The paragraph newlines we injected earlier got swallowed by the join;
  // re-derive them by looking at the original XML for paragraph boundaries.
  const paragraphs = xml.split(/<\/w:p>/).map(chunk => {
    const ms = chunk.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    return ms.map(m => m.replace(/<[^>]+>/g, "")).join("");
  });
  const joined = paragraphs.join("\n").trim();
  return joined || text;
}

// Read the document.xml entry from a .docx (zip) without pulling in jszip.
// Implements just enough of the zip central-directory parser to find the file
// and inflate it via DecompressionStream.
async function readDocxXml(bytes: Uint8Array): Promise<string | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory record signature: 0x06054b50.
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return null;
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const decoder = new TextDecoder();
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const compMethod = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name === "word/document.xml") {
      // Local file header: 30 bytes + name + extra.
      const lhNameLen = view.getUint16(localOffset + 26, true);
      const lhExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
      const data = bytes.subarray(dataStart, dataStart + compSize);
      if (compMethod === 0) return decoder.decode(data);
      if (compMethod === 8) {
        // raw deflate — DecompressionStream("deflate-raw") is widely supported.
        const buf = data.slice().buffer;
        const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        const out = await new Response(stream).arrayBuffer();
        return decoder.decode(new Uint8Array(out));
      }
      return null;
    }
    if (cdSize && p - cdOffset >= cdSize) break;
  }
  return null;
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
  textTransform: "uppercase", color: "var(--brass)", marginBottom: 6,
};

const primaryBtn: React.CSSProperties = {
  background: "var(--brass)", color: "var(--obsidian)", border: "none",
  borderRadius: 6, padding: "10px 18px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};

const subtleBtn: React.CSSProperties = {
  background: "transparent", color: "var(--brass)", border: "1px solid var(--fog)",
  borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};

const subtleBtnDark: React.CSSProperties = {
  background: "transparent", color: "var(--fog)", border: "1px solid var(--fog)",
  borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink)", opacity: 0.85,
  whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0,
};
