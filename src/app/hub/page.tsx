"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS, categories } from "@/data/questions";
import {
  type Transcript,
  fetchTranscripts,
  searchTranscripts,
  uploadTranscript,
  deleteTranscript,
  transcriptDownloadUrl,
  snippetsAround,
} from "@/lib/transcripts";
import {
  fetchHubData,
  saveAnnouncement,
  saveDecision,
  saveHubDocument,
  saveSharedLink,
  upsertHubProfile,
  type Announcement,
  type Decision,
  type HubDocument,
  type MemberProfile,
  type SharedLink,
} from "@/lib/hub";

const DOC_CATEGORIES = ["Legal", "Financial", "Research", "Meeting Notes", "Other"];
const LINK_CATEGORIES = ["Mentorship", "Legal", "Financial", "Education", "Networking", "Tools", "Other"];
const DISPLAY_FONT = "var(--font-display)";

const sectionStyle = (open: boolean) => ({
  background: "var(--surface)", borderRadius: 12, marginBottom: 16, overflow: "hidden" as const,
  border: open ? "1px solid var(--gold)" : "1px solid var(--border)", transition: "border-color 0.2s",
});
const sectionHeader = { padding: "16px 20px", cursor: "pointer" as const, display: "flex", justifyContent: "space-between" as const, alignItems: "center" as const };
const sectionBody = { padding: "0 20px 20px" };
const inputStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)", borderRadius: 8, padding: "10px 14px", fontSize: 14, width: "100%" as const };
const btnStyle = { background: "var(--gold)", color: "var(--bg)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600 as const, fontSize: 14, cursor: "pointer" as const };
const smallBtnStyle = { ...btnStyle, padding: "6px 14px", fontSize: 12 };
const tagStyle = { display: "inline-block" as const, padding: "3px 10px", borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 11, color: "var(--muted)" };

export default function HubPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ announcements: true });

  // State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [documents, setDocuments] = useState<HubDocument[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [transcriptDebounced, setTranscriptDebounced] = useState("");
  const [transcriptUploading, setTranscriptUploading] = useState(false);
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<number | null>(null);
  const transcriptSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [message, setMessage] = useState("");

  // Form state
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newDecision, setNewDecision] = useState({ description: "", present: [] as string[], outcome: "" });
  const [newLink, setNewLink] = useState({ url: "", title: "", category: "Other" });
  const [docCategory, setDocCategory] = useState("Other");
  const [profileEdit, setProfileEdit] = useState({ role: "", contact: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void (async () => {
      const [hub, transcriptRows] = await Promise.all([fetchHubData(), fetchTranscripts()]);
      setAnnouncements(hub.announcements);
      setDecisions(hub.decisions);
      setDocuments(hub.documents);
      setLinks(hub.links);
      setProfiles(hub.profiles);
      setTranscripts(transcriptRows);

      const existing = hub.profiles[u] || { name: u, role: "", contact: "", lastActive: "" };
      const profile = { ...existing, name: u, lastActive: new Date().toISOString() };
      await upsertHubProfile(profile);
      setProfiles(prev => ({ ...prev, [u]: profile }));
      setProfileEdit({ role: profile.role || "", contact: profile.contact || "" });
    })();
  }, [router]);

  const toggle = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));

  // Debounce transcript-search input (250ms) so we don't hammer the DB on
  // every keystroke. Empty query reverts to the default chronological list.
  useEffect(() => {
    if (transcriptSearchTimer.current) clearTimeout(transcriptSearchTimer.current);
    transcriptSearchTimer.current = setTimeout(() => setTranscriptDebounced(transcriptQuery), 250);
    return () => { if (transcriptSearchTimer.current) clearTimeout(transcriptSearchTimer.current); };
  }, [transcriptQuery]);

  useEffect(() => {
    void (async () => {
      const next = transcriptDebounced.trim()
        ? await searchTranscripts(transcriptDebounced)
        : await fetchTranscripts();
      setTranscripts(next);
    })();
  }, [transcriptDebounced]);

  const getMemberCompletion = useCallback((name: string) => {
    // Check new multi-survey key first, fallback to legacy key
    const raw = localStorage.getItem(`meridian_answers_operating-agreement_${name}`) || localStorage.getItem(`meridian_answers_${name}`);
    if (!raw) return 0;
    const answers = JSON.parse(raw);
    const total = categories.reduce((s, c) => s + c.questions.length, 0);
    const answered = Object.values(answers).filter((v: unknown) => {
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === "string" && (v as string).trim() !== "";
    }).length;
    return Math.round((answered / total) * 100);
  }, []);

  // Handlers
  const addAnnouncement = async () => {
    if (!newAnnouncement.trim() || !user) return;
    const { data, error } = await saveAnnouncement(user, newAnnouncement.trim());
    if (error) { setMessage(error); return; }
    if (data) setAnnouncements(prev => [data, ...prev]);
    setNewAnnouncement("");
    setMessage("Announcement posted.");
  };

  const addDecision = async () => {
    if (!newDecision.description.trim() || !user) return;
    const { data, error } = await saveDecision(user, newDecision);
    if (error) { setMessage(error); return; }
    if (data) setDecisions(prev => [data, ...prev]);
    setNewDecision({ description: "", present: [], outcome: "" });
    setMessage("Decision logged.");
  };

  const addLink = async () => {
    if (!newLink.url.trim() || !newLink.title.trim() || !user) return;
    const { data, error } = await saveSharedLink(user, newLink);
    if (error) { setMessage(error); return; }
    if (data) setLinks(prev => [data, ...prev]);
    setNewLink({ url: "", title: "", category: "Other" });
    setMessage("Link saved.");
  };

  const handleFileUpload = () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const data = reader.result as string;
        const { data: doc, error } = await saveHubDocument(user, { filename: file.name, category: docCategory, data, mimeType: file.type });
        if (error) { setMessage(error); return; }
        if (doc) setDocuments(prev => [doc, ...prev]);
        setMessage("Document uploaded.");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Transcript upload — DB-backed, with plain-text body extraction for .txt
  // (PDF/DOCX would need client-side parsing; for now those upload as
  // body-empty rows that still link to the original file in Supabase Storage).
  const handleTranscriptUpload = () => {
    if (!user) return;
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.pdf,.doc,.docx,text/plain,application/pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user) return;
      const title = prompt("Title for this transcript:", file.name.replace(/\.[^.]+$/, "")) || file.name;
      const occurredStr = prompt("Date this meeting occurred (YYYY-MM-DD), or leave blank:") || "";
      const occurredAt = occurredStr.trim() ? new Date(occurredStr.trim()).toISOString() : null;
      setTranscriptUploading(true);
      const result = await uploadTranscript({ file, title, occurredAt, uploader: user });
      setTranscriptUploading(false);
      if (result.error) { setMessage(`Upload failed: ${result.error}`); return; }
      if (!result.fileStored) {
        // Body still saved; just couldn't push the original file. Common cause:
        // Storage bucket "transcripts" doesn't exist yet — alert once so the
        // admin can create it in the Supabase dashboard.
        console.warn("Transcript body saved but original file wasn't stored.");
      }
      // Refresh — search query (if any) is preserved.
      const next = transcriptDebounced.trim()
        ? await searchTranscripts(transcriptDebounced)
        : await fetchTranscripts();
      setTranscripts(next);
      setMessage(result.fileStored ? "Transcript uploaded." : "Transcript text saved. Original file storage still needs setup.");
    };
    input.click();
  };

  const handleTranscriptDelete = async (id: number) => {
    if (!user) return;
    if (!confirm("Delete this transcript?")) return;
    const { error } = await deleteTranscript(id, user);
    if (error) { setMessage(error); return; }
    setTranscripts(prev => prev.filter(t => t.id !== id));
    setMessage("Transcript deleted.");
  };

  const handleTranscriptDownload = async (t: Transcript) => {
    const url = await transcriptDownloadUrl(t);
    if (!url) {
      setMessage("Original file isn't available. Only the extracted text is stored for this transcript.");
      return;
    }
    window.open(url, "_blank");
  };

  const downloadFile = (data: string, filename: string) => {
    const a = window.document.createElement("a");
    a.href = data;
    a.download = filename;
    a.click();
  };

  const saveProfile = async () => {
    if (!user) return;
    const profile = { ...(profiles[user] || {}), name: user, role: profileEdit.role, contact: profileEdit.contact, lastActive: new Date().toISOString() };
    const { data, error } = await upsertHubProfile(profile);
    if (error) { setMessage(error); return; }
    setProfiles(prev => ({ ...prev, [user]: data ?? profile }));
    setEditingProfile(false);
    setMessage("Profile saved.");
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
    catch { return d; }
  };

  const filteredLinks = links.filter(l =>
    linkSearch === "" || l.title.toLowerCase().includes(linkSearch.toLowerCase()) || l.category.toLowerCase().includes(linkSearch.toLowerCase()) || l.url.toLowerCase().includes(linkSearch.toLowerCase())
  );
  const openHubSection = (section: string) => setOpenSections(prev => ({ ...prev, [section]: true }));

  if (!user) return null;
  const completedSurveys = MEMBERS.filter(m => getMemberCompletion(m) === 100).length;

  return (
    <div style={{ padding: "84px 20px 100px", maxWidth: 1120, margin: "0 auto" }} className="hub-root">
      <header style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 700, marginBottom: 8 }}>
          Member Portal
        </p>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
          Platform Archive
        </h1>
        <p style={{ color: "var(--ink)", opacity: 0.68, fontSize: 14, maxWidth: 690, lineHeight: 1.6 }}>
          A shared archive for announcements, member profiles, resource links, transcript history, and legacy uploads. Daily operating work now lives in Dashboard, Tasks, CRM, Deals, Operations, Money, Projects, Documents, and Meetings.
        </p>
      </header>

      {message && (
        <div className="hub-message" role="status">
          {message}
        </div>
      )}

      <section className="hub-status-grid">
        <article className="hub-status-card">
          <span>Announcements</span>
          <strong>{announcements.length}</strong>
          <p>Broadcasts to the member group.</p>
        </article>
        <article className="hub-status-card">
          <span>Transcripts</span>
          <strong>{transcripts.length}</strong>
          <p>Searchable meeting and planning records.</p>
        </article>
        <article className="hub-status-card">
          <span>Resources</span>
          <strong>{filteredLinks.length}</strong>
          <p>Shared links and reference tools.</p>
        </article>
        <article className="hub-status-card">
          <span>Survey Completion</span>
          <strong>{completedSurveys}/{MEMBERS.length}</strong>
          <p>Member operating agreement input.</p>
        </article>
      </section>

      <section className="hub-directory-grid">
        <button className="hub-directory-card" onClick={() => router.push("/dashboard")}>
          <span>Member Home</span>
          <strong>Review priorities and daily updates</strong>
        </button>
        <button className="hub-directory-card" onClick={() => router.push("/documents")}>
          <span>Documents</span>
          <strong>Source of truth for canonical files</strong>
        </button>
        <button className="hub-directory-card" onClick={() => router.push("/decisions")}>
          <span>Decisions</span>
          <strong>Operating agreement decisions and vote record</strong>
        </button>
        <button className="hub-directory-card" onClick={() => router.push("/meetings")}>
          <span>Meetings</span>
          <strong>Agenda, minutes, transcripts, and tasks</strong>
        </button>
        <button className="hub-directory-card" onClick={() => router.push("/crm")}>
          <span>CRM</span>
          <strong>Lead, seller, buyer, and disposition workspace</strong>
        </button>
        <button className="hub-directory-card" onClick={() => router.push("/operations")}>
          <span>Operations</span>
          <strong>VA briefs, time approval, lead ops, and money ops</strong>
        </button>
      </section>

      <div style={{ background: "rgba(201,168,120,0.1)", border: "1px solid rgba(201,168,120,0.2)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "var(--muted)", marginBottom: 24, lineHeight: 1.55 }}>
        Use this page for group-wide posts and older shared resources. Use Documents for final files, Decisions for the official vote record, Meetings for agendas and transcript extraction, and CRM for deal activity.
      </div>

      <nav className="hub-section-jump" aria-label="Hub sections">
        <button onClick={() => openHubSection("announcements")}>Announcements</button>
        <button onClick={() => openHubSection("transcripts")}>Transcripts</button>
        <button onClick={() => openHubSection("profiles")}>Profiles</button>
        <button onClick={() => openHubSection("links")}>Links</button>
        <button onClick={() => openHubSection("documents")}>Legacy Uploads</button>
      </nav>

      {/* ANNOUNCEMENTS */}
      <div style={sectionStyle(!!openSections.announcements)}>
        <div style={sectionHeader} onClick={() => toggle("announcements")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Announcements</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.announcements ? "−" : "+"}</span>
        </div>
        {openSections.announcements && (
          <div style={sectionBody}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input style={inputStyle} placeholder="Share an update with the group..." value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} onKeyDown={e => e.key === "Enter" && addAnnouncement()} />
              <button style={smallBtnStyle} onClick={addAnnouncement}>Post</button>
            </div>
            {announcements.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No announcements yet. Be the first to post!</p>}
            {announcements.map(a => (
              <div key={a.id} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{a.author}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(a.date)}</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{a.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MEETING TRANSCRIPTS */}
      <div style={sectionStyle(!!openSections.transcripts)}>
        <div style={sectionHeader} onClick={() => toggle("transcripts")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Meeting Transcripts</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.transcripts ? "−" : "+"}</span>
        </div>
        {openSections.transcripts && (
          <div style={sectionBody}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                type="text"
                value={transcriptQuery}
                onChange={e => setTranscriptQuery(e.target.value)}
                placeholder='Search transcripts (e.g. "voting threshold", "spousal consent")'
                style={{ ...inputStyle, flex: 1, minWidth: 240 }}
              />
              <button
                style={{ ...smallBtnStyle, opacity: transcriptUploading ? 0.6 : 1 }}
                disabled={transcriptUploading}
                onClick={handleTranscriptUpload}
              >
                {transcriptUploading ? "Uploading…" : "Upload Transcript"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
              Upload .txt for full-text search. Other formats (.pdf, .docx) save as files only — search them by title.
            </p>

            {transcripts.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                {transcriptDebounced.trim() ? "No matches." : "No transcripts uploaded yet."}
              </p>
            )}

            {transcripts.map(t => {
              const expanded = expandedTranscriptId === t.id;
              const matchSnippets = transcriptDebounced.trim() && t.body
                ? snippetsAround(t.body, transcriptDebounced)
                : [];
              return (
                <div key={t.id} style={{
                  background: "var(--surface2)", borderRadius: 8,
                  padding: "12px 16px", marginBottom: 8,
                  border: expanded ? "1px solid var(--gold)" : "1px solid transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, cursor: t.body ? "pointer" : "default" }}
                         onClick={() => t.body && setExpandedTranscriptId(expanded ? null : t.id)}>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{t.title}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)" }}>
                        {t.occurred_at ? formatDate(t.occurred_at) : "no date"}
                        {t.uploaded_by && ` · ${t.uploaded_by}`}
                        {t.body && ` · ${t.body.length.toLocaleString()} chars`}
                        {t.storage_path && " · file attached"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {t.storage_path && (
                        <button style={{ ...smallBtnStyle, background: "var(--surface)", color: "var(--gold)", border: "1px solid var(--border)" }}
                                onClick={() => handleTranscriptDownload(t)}>
                          ↓ File
                        </button>
                      )}
                      <button style={{ ...smallBtnStyle, background: "var(--surface)", color: "var(--gold-dim)", border: "1px solid rgba(142,107,63,0.3)" }}
                              onClick={() => handleTranscriptDelete(t.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Search-result snippets when a query is active. */}
                  {matchSnippets.length > 0 && !expanded && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--surface)", borderRadius: 6 }}>
                      {matchSnippets.map((s, i) => (
                        <p key={i} style={{ fontSize: 12, color: "var(--fg)", marginBottom: 4, lineHeight: 1.5 }}>{s}</p>
                      ))}
                    </div>
                  )}

                  {/* Full body when expanded. */}
                  {expanded && t.body && (
                    <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--surface)", borderRadius: 6, maxHeight: 480, overflowY: "auto" }}>
                      <pre style={{ fontSize: 12, color: "var(--fg)", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.55 }}>
                        {t.body}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DOCUMENT VAULT */}
      <div style={sectionStyle(!!openSections.documents)}>
        <div style={sectionHeader} onClick={() => toggle("documents")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Legacy Upload Vault</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.documents ? "−" : "+"}</span>
        </div>
        {openSections.documents && (
          <div style={sectionBody}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <select style={{ ...inputStyle, width: "auto", flex: "0 0 auto" }} value={docCategory} onChange={e => setDocCategory(e.target.value)}>
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button style={smallBtnStyle} onClick={() => handleFileUpload()}>Upload Document</button>
            </div>
            {documents.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No documents uploaded yet.</p>}
            {documents.map(d => (
              <div key={d.id} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{d.filename}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <span style={tagStyle}>{d.category}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{d.author} · {formatDate(d.date)}</span>
                  </div>
                </div>
                <button style={{ ...smallBtnStyle, background: "var(--surface)", color: "var(--gold)", border: "1px solid var(--border)" }} onClick={() => downloadFile(d.data, d.filename)}>
                  ↓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MEMBER PROFILES */}
      <div style={sectionStyle(!!openSections.profiles)}>
        <div style={sectionHeader} onClick={() => toggle("profiles")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Member Profiles</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.profiles ? "−" : "+"}</span>
        </div>
        {openSections.profiles && (
          <div style={sectionBody}>
            {MEMBERS.map(m => {
              const p = profiles[m];
              const completion = getMemberCompletion(m);
              const isMe = m === user;
              return (
                <div key={m} style={{ background: "var(--surface2)", borderRadius: 8, padding: "14px 16px", marginBottom: 8, borderLeft: isMe ? "3px solid var(--gold)" : "3px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: isMe ? "var(--gold)" : "var(--fg)" }}>{m} {isMe && "(you)"}</span>
                    <span style={{ fontSize: 11, color: completion === 100 ? "var(--gold)" : "var(--muted)" }}>Survey: {completion}%</span>
                  </div>
                  {p?.role && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Role: {p.role}</p>}
                  {p?.contact && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Contact: {p.contact}</p>}
                  {p?.lastActive && <p style={{ fontSize: 11, color: "var(--border)" }}>Last active: {formatDate(p.lastActive)}</p>}
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginTop: 8 }}>
                    <div style={{ height: "100%", background: completion === 100 ? "var(--gold)" : "var(--gold)", borderRadius: 2, width: `${completion}%`, transition: "width 0.3s" }} />
                  </div>
                  {isMe && !editingProfile && (
                    <button style={{ ...smallBtnStyle, marginTop: 8, background: "transparent", color: "var(--gold)", border: "1px solid var(--border)" }} onClick={() => setEditingProfile(true)}>
                      Edit Profile
                    </button>
                  )}
                  {isMe && editingProfile && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <input style={inputStyle} placeholder="Your role/skills" value={profileEdit.role} onChange={e => setProfileEdit({ ...profileEdit, role: e.target.value })} />
                      <input style={inputStyle} placeholder="Contact info (optional)" value={profileEdit.contact} onChange={e => setProfileEdit({ ...profileEdit, contact: e.target.value })} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={smallBtnStyle} onClick={saveProfile}>Save</button>
                        <button style={{ ...smallBtnStyle, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }} onClick={() => setEditingProfile(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KEY DECISIONS LOG */}
      <div style={sectionStyle(!!openSections.decisions)}>
        <div style={sectionHeader} onClick={() => toggle("decisions")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Legacy Decisions Log</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.decisions ? "−" : "+"}</span>
        </div>
        {openSections.decisions && (
          <div style={sectionBody}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, background: "var(--surface2)", borderRadius: 8, padding: 14 }}>
              <textarea style={{ ...inputStyle, minHeight: 60 }} placeholder="Describe the decision..." value={newDecision.description} onChange={e => setNewDecision({ ...newDecision, description: e.target.value })} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {MEMBERS.map(m => (
                  <label key={m} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={newDecision.present.includes(m)} onChange={() => setNewDecision(prev => ({
                      ...prev, present: prev.present.includes(m) ? prev.present.filter(x => x !== m) : [...prev.present, m]
                    }))} style={{ accentColor: "var(--gold)" }} />
                    {m}
                  </label>
                ))}
              </div>
              <input style={inputStyle} placeholder="Vote outcome (e.g., Approved 4-1)" value={newDecision.outcome} onChange={e => setNewDecision({ ...newDecision, outcome: e.target.value })} />
              <button style={smallBtnStyle} onClick={addDecision}>Log Decision</button>
            </div>
            {decisions.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No decisions logged yet.</p>}
            {decisions.map(d => (
              <div key={d.id} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{d.author}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(d.date)}</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 6 }}>{d.description}</p>
                {d.present.length > 0 && <p style={{ fontSize: 11, color: "var(--muted)" }}>Present: {d.present.join(", ")}</p>}
                {d.outcome && <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)", marginTop: 4 }}>Outcome: {d.outcome}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SHARED LINKS & RESOURCES */}
      <div style={sectionStyle(!!openSections.links)}>
        <div style={sectionHeader} onClick={() => toggle("links")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Shared Links & Resources</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.links ? "−" : "+"}</span>
        </div>
        {openSections.links && (
          <div style={sectionBody}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, background: "var(--surface2)", borderRadius: 8, padding: 14 }}>
              <input style={inputStyle} placeholder="Link title" value={newLink.title} onChange={e => setNewLink({ ...newLink, title: e.target.value })} />
              <input style={inputStyle} placeholder="https://..." value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} />
              <select style={{ ...inputStyle }} value={newLink.category} onChange={e => setNewLink({ ...newLink, category: e.target.value })}>
                {LINK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button style={smallBtnStyle} onClick={addLink}>Add Link</button>
            </div>
            <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Search links..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} />
            {filteredLinks.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No links shared yet.</p>}
            {filteredLinks.map(l => (
              <div key={l.id} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500, color: "var(--gold)", textDecoration: "none" }}>{l.title} ↗</a>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <span style={tagStyle}>{l.category}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{l.author} · {formatDate(l.date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .hub-status-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .hub-message {
          background: rgba(201,168,120,0.14);
          border: 1px solid rgba(201,168,120,0.34);
          border-radius: 10px;
          color: var(--obsidian);
          font-size: 13px;
          line-height: 1.45;
          margin: -6px 0 18px;
          padding: 11px 14px;
        }
        .hub-status-card {
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 12px;
          padding: 16px;
          min-height: 126px;
        }
        .hub-status-card span,
        .hub-directory-card span {
          display: block;
          color: var(--brass);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .hub-status-card strong {
          display: block;
          color: var(--obsidian);
          font-size: 24px;
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .hub-status-card p {
          color: var(--ink);
          font-size: 12px;
          line-height: 1.45;
          opacity: 0.68;
        }
        .hub-directory-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .hub-directory-card {
          appearance: none;
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 12px;
          cursor: pointer;
          min-height: 122px;
          padding: 16px;
          text-align: left;
        }
        .hub-directory-card strong {
          display: block;
          color: var(--obsidian);
          font-size: 15px;
          line-height: 1.35;
        }
        .hub-section-jump {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .hub-section-jump button {
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 999px;
          color: var(--ink);
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          padding: 8px 12px;
          text-transform: uppercase;
        }
        @media (max-width: 900px) {
          .hub-status-grid,
          .hub-directory-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 600px) {
          .hub-root { padding-top: 28px !important; }
          .hub-status-grid,
          .hub-directory-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
