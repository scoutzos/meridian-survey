"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Expense,
  MemberProfile,
  TrackerSettings,
  EXPENSE_CATEGORIES,
  fmtUSD,
  isAdmin,
  logAudit,
  monthBucket,
} from "@/lib/tracker";
import { MEMBERS } from "@/data/questions";
import TrackerShell, {
  trackerCard,
  trackerInput,
  trackerBtn,
  trackerBtnSubtle,
} from "@/components/TrackerShell";

const MONTH_BUCKET_COLOR: Record<string, string> = {
  "Unclassified": "#e55",
  "Pre-formation": "#888",
  "M1": "#C5A572",
  "M2": "#a38a5c",
  "M3": "#8c764f",
};

const PAID_BY_LABELS = ["TBD", "LLC Bank"] as const;

export default function ExpensesPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [date, setDate] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<string>("TBD");

  // filters
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Expense>>({});

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("tracker_expenses_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_expenses" }, () => load())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [s, p, e] = await Promise.all([
      supabase.from("tracker_settings").select("*").eq("key", "tracker").maybeSingle(),
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
      supabase.from("tracker_expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: true, nullsFirst: false }),
    ]);
    setSettings((s.data as TrackerSettings | null) ?? null);
    setProfiles((p.data as MemberProfile[] | null) ?? []);
    setExpenses((e.data as Expense[] | null) ?? []);
    setLoading(false);
  }

  const paidByOptions = useMemo(() => {
    const llcByName = (m: string) => profiles.find(p => p.member_name === m)?.llc_name || m;
    const memberOpts = MEMBERS.map(m => ({ value: m, label: llcByName(m) }));
    const labelOpts = PAID_BY_LABELS.map(l => ({ value: l, label: l }));
    return [...memberOpts, ...labelOpts];
  }, [profiles]);

  if (!user) return null;

  const admin = isAdmin(profiles, user);
  const start = settings?.llc_start_date ?? null;

  const allBuckets = Array.from(new Set(expenses.map(e => monthBucket(e.expense_date, start))));

  const filtered = expenses.filter(e => {
    if (filterMonth !== "all" && monthBucket(e.expense_date, start) !== filterMonth) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  function paidByDisplay(e: Expense): string {
    if (e.paid_by_member_name) {
      const llc = profiles.find(p => p.member_name === e.paid_by_member_name)?.llc_name;
      return llc || e.paid_by_member_name;
    }
    return e.paid_by_label || "—";
  }

  // resolve "Paid By" form value into the {paid_by_member_name, paid_by_label} pair
  function resolvePaidBy(value: string): { paid_by_member_name: string | null; paid_by_label: string | null } {
    if ((PAID_BY_LABELS as readonly string[]).includes(value)) {
      return { paid_by_member_name: null, paid_by_label: value };
    }
    return { paid_by_member_name: value || null, paid_by_label: null };
  }

  // Self-service expensing requires either admin or paying as your own LLC.
  function canPayAs(value: string): boolean {
    if (admin) return true;
    if ((PAID_BY_LABELS as readonly string[]).includes(value)) return false;
    return value === user;
  }

  async function addExpense() {
    if (!supabase || !user) return;
    const amt = Number(amount.replace(/[$,]/g, ""));
    if (!Number.isFinite(amt) || amt < 0) return;
    if (!description.trim() || !category.trim()) return;
    if (!canPayAs(paidBy)) {
      alert("You can only log expenses paid by your own LLC. Ask an admin for other payers.");
      return;
    }
    const pb = resolvePaidBy(paidBy);
    const row = {
      expense_date: date || null,
      category,
      description: description.trim(),
      amount: amt,
      paid_by_member_name: pb.paid_by_member_name,
      paid_by_label: pb.paid_by_label,
      created_by: user,
      updated_by: user,
    };
    const { data, error } = await supabase.from("tracker_expenses").insert(row).select().single();
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_expenses",
      row_id: String((data as Expense).id),
      action: "create",
      diff: { after: data },
    });
    setDate(""); setCategory(EXPENSE_CATEGORIES[0]); setDescription(""); setAmount(""); setPaidBy("TBD");
    void load();
  }

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setEditDraft({ ...e });
  }

  async function saveEdit() {
    if (!supabase || !user || editingId == null) return;
    if (!admin) {
      // non-admins can only edit expenses they paid (and not change the payer)
      const orig = expenses.find(e => e.id === editingId);
      if (!orig || orig.paid_by_member_name !== user) return;
      if (editDraft.paid_by_member_name !== user) return;
    }
    const before = expenses.find(e => e.id === editingId);
    const update = {
      expense_date: editDraft.expense_date ?? null,
      category: editDraft.category ?? "",
      description: editDraft.description ?? "",
      amount: Number(editDraft.amount ?? 0),
      paid_by_member_name: editDraft.paid_by_member_name ?? null,
      paid_by_label: editDraft.paid_by_label ?? null,
      updated_at: new Date().toISOString(),
      updated_by: user,
    };
    const { error } = await supabase.from("tracker_expenses").update(update).eq("id", editingId);
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_expenses",
      row_id: String(editingId),
      action: "update",
      diff: { before, after: update },
    });
    setEditingId(null);
    setEditDraft({});
    void load();
  }

  async function deleteExpense(e: Expense) {
    if (!supabase || !user) return;
    if (!admin && e.paid_by_member_name !== user) return;
    if (!confirm(`Delete expense "${e.description}"?`)) return;
    const { error } = await supabase
      .from("tracker_expenses")
      .update({ deleted_at: new Date().toISOString(), updated_by: user })
      .eq("id", e.id);
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_expenses",
      row_id: String(e.id),
      action: "delete",
      diff: { before: e },
    });
    void load();
  }

  return (
    <TrackerShell title="Expenses" subtitle="Log every cost the LLC incurs. Month bucket auto-classifies by date.">
      {loading && <div style={{ color: "var(--muted)" }}>Loading…</div>}

      <div style={{ ...trackerCard, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add expense</h2>
        <div style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr 120px 200px 120px", gap: 8, alignItems: "end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={trackerInput} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Category</div>
            <select value={category} onChange={e => setCategory(e.target.value)} style={trackerInput}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Description</div>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} style={trackerInput} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Amount</div>
            <input
              type="text"
              placeholder="$0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={trackerInput}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Paid by</div>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} style={trackerInput}>
              {paidByOptions.map(o => (
                <option key={o.value} value={o.value} disabled={!canPayAs(o.value)}>
                  {o.label}{!canPayAs(o.value) ? "  (admin)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button onClick={addExpense} style={trackerBtn}>Add</button>
        </div>
        {!date && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#C5A572" }}>
            ⚠ No date — this expense will appear under <b>Unclassified</b> until you set one.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Filter:</span>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...trackerInput, width: "auto" }}>
          <option value="all">All months</option>
          {allBuckets.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...trackerInput, width: "auto" }}>
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)" }}>
          {filtered.length} expenses · <b style={{ color: "var(--fg)" }}>{fmtUSD(total)}</b>
        </span>
      </div>

      <div style={{ ...trackerCard, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface2)", textAlign: "left" }}>
              <th style={th}>Date</th>
              <th style={th}>Bucket</th>
              <th style={th}>Category</th>
              <th style={th}>Description</th>
              <th style={{ ...th, textAlign: "right" }}>Amount</th>
              <th style={th}>Paid By</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const bucket = monthBucket(e.expense_date, start);
              const editable = admin || e.paid_by_member_name === user;
              if (editingId === e.id) {
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
                    <td style={td}>
                      <input
                        type="date"
                        value={editDraft.expense_date ?? ""}
                        onChange={ev => setEditDraft({ ...editDraft, expense_date: ev.target.value || null })}
                        style={{ ...trackerInput, padding: "4px 6px" }}
                      />
                    </td>
                    <td style={td}>
                      <span style={bucketBadge(bucket)}>{bucket}</span>
                    </td>
                    <td style={td}>
                      <select
                        value={editDraft.category ?? ""}
                        onChange={ev => setEditDraft({ ...editDraft, category: ev.target.value })}
                        style={{ ...trackerInput, padding: "4px 6px" }}
                      >
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <input
                        type="text"
                        value={editDraft.description ?? ""}
                        onChange={ev => setEditDraft({ ...editDraft, description: ev.target.value })}
                        style={{ ...trackerInput, padding: "4px 6px" }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <input
                        type="number"
                        value={Number(editDraft.amount ?? 0)}
                        onChange={ev => setEditDraft({ ...editDraft, amount: Number(ev.target.value) })}
                        style={{ ...trackerInput, padding: "4px 6px", textAlign: "right" }}
                      />
                    </td>
                    <td style={td}>
                      <select
                        value={editDraft.paid_by_member_name ?? editDraft.paid_by_label ?? ""}
                        onChange={ev => {
                          const v = ev.target.value;
                          const r = (PAID_BY_LABELS as readonly string[]).includes(v)
                            ? { paid_by_member_name: null, paid_by_label: v }
                            : { paid_by_member_name: v, paid_by_label: null };
                          setEditDraft({ ...editDraft, ...r });
                        }}
                        style={{ ...trackerInput, padding: "4px 6px" }}
                      >
                        {paidByOptions.map(o => (
                          <option key={o.value} value={o.value} disabled={!admin && o.value !== user}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <button onClick={saveEdit} style={trackerBtn}>Save</button>{" "}
                      <button onClick={() => { setEditingId(null); setEditDraft({}); }} style={trackerBtnSubtle}>Cancel</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{e.expense_date ?? <span style={{ color: "#e55" }}>—</span>}</td>
                  <td style={td}><span style={bucketBadge(bucket)}>{bucket}</span></td>
                  <td style={td}>{e.category}</td>
                  <td style={td}>{e.description}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtUSD(Number(e.amount))}</td>
                  <td style={td}>{paidByDisplay(e)}</td>
                  <td style={td}>
                    {editable ? (
                      <>
                        <button onClick={() => startEdit(e)} style={iconBtn}>Edit</button>{" "}
                        <button onClick={() => deleteExpense(e)} style={iconBtnDanger}>Delete</button>
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && !loading && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: 24 }}>No expenses match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </TrackerShell>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
const iconBtn: React.CSSProperties = { background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer" };
const iconBtnDanger: React.CSSProperties = { ...iconBtn, color: "#e55", borderColor: "rgba(229,85,85,0.3)" };

function bucketBadge(bucket: string): React.CSSProperties {
  const color = MONTH_BUCKET_COLOR[bucket] ?? "#888";
  return {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    background: bucket === "Unclassified" ? "rgba(229,85,85,0.12)" : "var(--surface2)",
    color,
    border: `1px solid ${color}33`,
  };
}
