"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import { isAdmin, type MemberProfile } from "@/lib/tracker";
import {
  ALL_MEMBERS_LABEL,
  createActionItem,
  deleteActionItem,
  fetchActionItems,
  isOwnedBy,
  updateActionItemStatus,
  type ActionItem,
  type ActionItemStatus,
} from "@/lib/action-items";

const DISPLAY_FONT = "var(--font-display)";

const STATUS_ORDER: ActionItemStatus[] = ["open", "in-progress", "done"];
const STATUS_LABEL: Record<ActionItemStatus, string> = {
  "open": "Open",
  "in-progress": "In Progress",
  "done": "Done",
};

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ActionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    assigned_to: ALL_MEMBERS_LABEL,
    due_date: "",
  });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchActionItems();
    setItems(data);
    if (supabase) {
      const { data: prof } = await supabase.from("tracker_member_profiles").select("*");
      setProfiles((prof as MemberProfile[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void reload();
  }, [router, reload]);

  const grouped = useMemo(() => {
    const out: Record<ActionItemStatus, ActionItem[]> = { open: [], "in-progress": [], done: [] };
    for (const i of items) out[i.status].push(i);
    return out;
  }, [items]);

  if (!user) return null;
  const admin = isAdmin(profiles, user);

  const handleStatusChange = async (item: ActionItem, status: ActionItemStatus) => {
    const { error } = await updateActionItemStatus(item.id, status, user);
    if (error) { alert(error); return; }
    setItems(prev => prev.map(i => i.id === item.id ? {
      ...i, status, completed_at: status === "done" ? new Date().toISOString() : null,
    } : i));
  };

  const handleDelete = async (item: ActionItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const { error } = await deleteActionItem(item.id, user);
    if (error) { alert(error); return; }
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleCreate = async () => {
    if (!draft.title.trim()) { alert("Title is required."); return; }
    setSaving(true);
    const { error } = await createActionItem({
      title: draft.title,
      description: draft.description,
      assigned_to: draft.assigned_to,
      due_date: draft.due_date || null,
    }, user);
    setSaving(false);
    if (error) { alert(error); return; }
    setDraft({ title: "", description: "", assigned_to: ALL_MEMBERS_LABEL, due_date: "" });
    setShowNew(false);
    void reload();
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "84px 20px 100px" }} className="actions-root">
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
            Operations
          </p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            Action items
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
            Track what each of us owns. Mark your work done as you finish it.
          </p>
        </div>
        {admin && (
          <button
            onClick={() => setShowNew(s => !s)}
            style={{
              background: showNew ? "transparent" : "var(--brass)",
              color: showNew ? "var(--brass)" : "var(--obsidian)",
              border: showNew ? "1px solid var(--brass)" : "none",
              borderRadius: 6, padding: "10px 16px", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {showNew ? "Cancel" : "New action"}
          </button>
        )}
      </header>

      {showNew && admin && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 12,
          padding: 18, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <input
            placeholder="Title (required)"
            value={draft.title}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
          />
          <textarea
            placeholder="Description (optional)"
            value={draft.description}
            onChange={e => setDraft({ ...draft, description: e.target.value })}
            rows={3}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="action-form-row">
            <div>
              <label style={labelStyle}>Assigned to</label>
              <select
                value={draft.assigned_to}
                onChange={e => setDraft({ ...draft, assigned_to: e.target.value })}
              >
                <option value={ALL_MEMBERS_LABEL}>{ALL_MEMBERS_LABEL}</option>
                {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input
                type="date"
                value={draft.due_date}
                onChange={e => setDraft({ ...draft, due_date: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                background: "var(--brass)", color: "var(--obsidian)", border: "none",
                borderRadius: 6, padding: "10px 18px", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

      {!loading && STATUS_ORDER.map(status => {
        const list = grouped[status];
        return (
          <section key={status} style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 11, fontWeight: 700, color: "var(--brass)",
              letterSpacing: "0.22em", textTransform: "uppercase",
              marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--fog)",
            }}>
              {STATUS_LABEL[status]} · {list.length}
            </h2>
            {list.length === 0 && (
              <p style={{ color: "var(--ink)", opacity: 0.5, fontSize: 13, padding: "8px 0" }}>
                Nothing here.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(item => {
                const due = formatDue(item.due_date);
                const mine = isOwnedBy(item, user);
                const canMarkDone = mine || admin;
                return (
                  <div key={item.id} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--fog)",
                    borderLeft: `3px solid ${status === "done" ? "var(--fog)" : "var(--brass)"}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    opacity: status === "done" ? 0.65 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <p style={{
                        fontSize: 15, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3,
                        textDecoration: status === "done" ? "line-through" : "none",
                      }}>
                        {item.title}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {due && (
                          <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.6, alignSelf: "center" }}>
                            {due}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.description && (
                      <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.72, lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                    )}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 8, flexWrap: "wrap", paddingTop: 4,
                    }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--ink)", opacity: 0.7 }}>
                        <span style={{
                          background: "var(--bone)", border: "1px solid var(--fog)",
                          padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500,
                        }}>
                          {item.assigned_to ?? "Unassigned"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canMarkDone && status !== "in-progress" && status !== "done" && (
                          <button onClick={() => handleStatusChange(item, "in-progress")} style={subtleBtnStyle}>
                            Start
                          </button>
                        )}
                        {canMarkDone && status !== "done" && (
                          <button onClick={() => handleStatusChange(item, "done")} style={primaryBtnStyle}>
                            Mark done
                          </button>
                        )}
                        {canMarkDone && status === "done" && (
                          <button onClick={() => handleStatusChange(item, "open")} style={subtleBtnStyle}>
                            Reopen
                          </button>
                        )}
                        {admin && (
                          <button onClick={() => handleDelete(item)} style={subtleBtnStyle}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <style jsx>{`
        @media (max-width: 600px) {
          .actions-root { padding-top: 28px !important; }
          :global(.action-form-row) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
  textTransform: "uppercase", color: "var(--brass)", marginBottom: 6,
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--brass)", color: "var(--obsidian)", border: "none",
  borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};

const subtleBtnStyle: React.CSSProperties = {
  background: "transparent", color: "var(--brass)", border: "1px solid var(--fog)",
  borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};
