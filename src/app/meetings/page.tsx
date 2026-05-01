"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import { isAdmin, type MemberProfile } from "@/lib/tracker";
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
    const { error } = await createMeetingNote({
      meeting_date: newNote.meeting_date,
      agenda: newNote.agenda,
      notes: newNote.notes,
      attendees: newNote.attendees,
    }, user);
    if (error) { alert(error); return; }
    setNewNote({ meeting_date: "", agenda: "", notes: "", attendees: [] });
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
              onClick={() => setShowNewNote(s => !s)}
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
            padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={newNote.meeting_date}
                onChange={e => setNewNote({ ...newNote, meeting_date: e.target.value })}
              />
            </div>
            <textarea
              rows={2}
              placeholder="Agenda"
              value={newNote.agenda}
              onChange={e => setNewNote({ ...newNote, agenda: e.target.value })}
            />
            <textarea
              rows={5}
              placeholder="Notes"
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
