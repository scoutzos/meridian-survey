"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS, categories } from "@/data/questions";

// Shared localStorage keys
const KEYS = {
  announcements: "meridian_shared_announcements",
  decisions: "meridian_shared_decisions",
  documents: "meridian_shared_documents",
  transcripts: "meridian_shared_transcripts",
  links: "meridian_shared_links",
  profiles: "meridian_shared_profiles",
};

interface Announcement { id: string; author: string; text: string; date: string; }
interface Decision { id: string; author: string; description: string; date: string; present: string[]; outcome: string; }
interface Document { id: string; author: string; filename: string; category: string; date: string; data: string; mimeType: string; }
interface Transcript { id: string; author: string; title: string; date: string; data?: string; mimeType?: string; }
interface SharedLink { id: string; author: string; url: string; title: string; category: string; date: string; }
interface MemberProfile { name: string; role: string; contact: string; lastActive: string; }

function getShared<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function setShared<T>(key: string, data: T[]) { localStorage.setItem(key, JSON.stringify(data)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const DOC_CATEGORIES = ["Legal", "Financial", "Research", "Meeting Notes", "Other"];
const LINK_CATEGORIES = ["Mentorship", "Legal", "Financial", "Education", "Networking", "Tools", "Other"];

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});

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
    setAnnouncements(getShared(KEYS.announcements));
    setDecisions(getShared(KEYS.decisions));
    setDocuments(getShared(KEYS.documents));
    setLinks(getShared(KEYS.links));
    setProfiles(JSON.parse(localStorage.getItem(KEYS.profiles) || "{}"));

    const t = getShared<Transcript>(KEYS.transcripts);
    if (t.length === 0) {
      const seed: Transcript[] = [{ id: "seed1", author: "System", title: "March 17, 2026 — First Group Meeting with Courtney", date: "2026-03-17T20:00:00", }];
      setShared(KEYS.transcripts, seed);
      setTranscripts(seed);
    } else {
      setTranscripts(t);
    }

    // Update last active
    const p = JSON.parse(localStorage.getItem(KEYS.profiles) || "{}");
    p[u] = { ...(p[u] || { name: u, role: "", contact: "" }), name: u, lastActive: new Date().toISOString() };
    localStorage.setItem(KEYS.profiles, JSON.stringify(p));
    setProfiles(p);
    if (p[u]) setProfileEdit({ role: p[u].role || "", contact: p[u].contact || "" });
  }, [router]);

  const toggle = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));

  const getMemberCompletion = useCallback((name: string) => {
    const raw = localStorage.getItem(`meridian_answers_${name}`);
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
  const addAnnouncement = () => {
    if (!newAnnouncement.trim() || !user) return;
    const item: Announcement = { id: genId(), author: user, text: newAnnouncement.trim(), date: new Date().toISOString() };
    const updated = [item, ...announcements];
    setShared(KEYS.announcements, updated);
    setAnnouncements(updated);
    setNewAnnouncement("");
  };

  const addDecision = () => {
    if (!newDecision.description.trim() || !user) return;
    const item: Decision = { id: genId(), author: user, ...newDecision, date: new Date().toISOString() };
    const updated = [item, ...decisions];
    setShared(KEYS.decisions, updated);
    setDecisions(updated);
    setNewDecision({ description: "", present: [], outcome: "" });
  };

  const addLink = () => {
    if (!newLink.url.trim() || !newLink.title.trim() || !user) return;
    const item: SharedLink = { id: genId(), author: user, ...newLink, date: new Date().toISOString() };
    const updated = [item, ...links];
    setShared(KEYS.links, updated);
    setLinks(updated);
    setNewLink({ url: "", title: "", category: "Other" });
  };

  const handleFileUpload = (type: "document" | "transcript") => {
    const input = window.document.createElement("input");
    input.type = "file";
    if (type === "transcript") input.accept = ".txt,.pdf,.doc,.docx";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        if (type === "document") {
          const item: Document = { id: genId(), author: user, filename: file.name, category: docCategory, date: new Date().toISOString(), data, mimeType: file.type };
          const updated = [item, ...documents];
          setShared(KEYS.documents, updated);
          setDocuments(updated);
        } else {
          const title = prompt("Enter a title for this transcript:", file.name) || file.name;
          const item: Transcript = { id: genId(), author: user, title, date: new Date().toISOString(), data, mimeType: file.type };
          const updated = [item, ...transcripts];
          setShared(KEYS.transcripts, updated);
          setTranscripts(updated);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const downloadFile = (data: string, filename: string) => {
    const a = window.document.createElement("a");
    a.href = data;
    a.download = filename;
    a.click();
  };

  const saveProfile = () => {
    if (!user) return;
    const p = { ...profiles };
    p[user] = { ...(p[user] || {}), name: user, role: profileEdit.role, contact: profileEdit.contact, lastActive: new Date().toISOString() };
    localStorage.setItem(KEYS.profiles, JSON.stringify(p));
    setProfiles(p);
    setEditingProfile(false);
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
    catch { return d; }
  };

  const filteredLinks = links.filter(l =>
    linkSearch === "" || l.title.toLowerCase().includes(linkSearch.toLowerCase()) || l.category.toLowerCase().includes(linkSearch.toLowerCase()) || l.url.toLowerCase().includes(linkSearch.toLowerCase())
  );

  if (!user) return null;

  return (
    <div style={{ padding: "72px 16px 80px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Partnership Hub</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Meridian Collective — Transparency & Collaboration</p>
      </div>

      <div style={{ background: "rgba(200,170,50,0.1)", border: "1px solid rgba(200,170,50,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>
        📱 Documents uploaded here are stored locally on your device. For shared access across devices, upload to the Google Drive.
      </div>

      {/* ANNOUNCEMENTS */}
      <div style={sectionStyle(!!openSections.announcements)}>
        <div style={sectionHeader} onClick={() => toggle("announcements")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>📢 Announcements</h2>
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>📝 Meeting Transcripts</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.transcripts ? "−" : "+"}</span>
        </div>
        {openSections.transcripts && (
          <div style={sectionBody}>
            <button style={{ ...smallBtnStyle, marginBottom: 16 }} onClick={() => handleFileUpload("transcript")}>Upload Transcript</button>
            {transcripts.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No transcripts uploaded yet.</p>}
            {transcripts.map(t => (
              <div key={t.id} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{t.title}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(t.date)} · {t.author}</p>
                </div>
                {t.data && (
                  <button style={{ ...smallBtnStyle, background: "var(--surface)", color: "var(--gold)", border: "1px solid var(--border)" }} onClick={() => downloadFile(t.data!, t.title)}>
                    ↓
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DOCUMENT VAULT */}
      <div style={sectionStyle(!!openSections.documents)}>
        <div style={sectionHeader} onClick={() => toggle("documents")}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>📁 Document Vault</h2>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{openSections.documents ? "−" : "+"}</span>
        </div>
        {openSections.documents && (
          <div style={sectionBody}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <select style={{ ...inputStyle, width: "auto", flex: "0 0 auto" }} value={docCategory} onChange={e => setDocCategory(e.target.value)}>
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button style={smallBtnStyle} onClick={() => handleFileUpload("document")}>Upload Document</button>
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>👥 Member Profiles</h2>
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
                    <span style={{ fontSize: 11, color: completion === 100 ? "#5a5" : "var(--muted)" }}>Survey: {completion}%</span>
                  </div>
                  {p?.role && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Role: {p.role}</p>}
                  {p?.contact && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Contact: {p.contact}</p>}
                  {p?.lastActive && <p style={{ fontSize: 11, color: "var(--border)" }}>Last active: {formatDate(p.lastActive)}</p>}
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginTop: 8 }}>
                    <div style={{ height: "100%", background: completion === 100 ? "#5a5" : "var(--gold)", borderRadius: 2, width: `${completion}%`, transition: "width 0.3s" }} />
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>⚖️ Key Decisions Log</h2>
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>🔗 Shared Links & Resources</h2>
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
    </div>
  );
}
