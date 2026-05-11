"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchProjectTimeline,
  fetchProjects,
  type Project,
  type ProjectTimelineEvent,
} from "@/lib/projects";
import {
  createProjectDocument,
  createProjectRisk,
  createVendor,
  fetchProjectDocuments,
  fetchProjectRisks,
  fetchVendors,
  updateProjectRiskStatus,
  type ProjectDocument,
  type ProjectRisk,
  type RiskLevel,
  type RiskStatus,
  type Vendor,
} from "@/lib/operations";

const DISPLAY_FONT = "var(--font-display)";

type ProjectTab = "overview" | "risks" | "documents" | "vendors" | "timeline";
const PROJECT_TABS: ProjectTab[] = ["overview", "risks", "documents", "vendors", "timeline"];

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function statusLabel(value: string): string {
  return value.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ProjectTimelineEvent[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [riskDraft, setRiskDraft] = useState({ title: "", likelihood: "medium" as RiskLevel, impact: "medium" as RiskLevel, mitigation: "", owner: "", next_review_date: "" });
  const [docDraft, setDocDraft] = useState({ title: "", category: "Due Diligence", url: "", notes: "" });
  const [vendorDraft, setVendorDraft] = useState({ name: "", company: "", role: "Contractor", phone: "", email: "", reliability: "", pricing_notes: "", general_notes: "" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchProjects();
    const requestedProject = new URLSearchParams(window.location.search).get("project");
    setProjects(rows);
    setSelectedId(prev => requestedProject && rows.some(project => project.id === requestedProject) ? requestedProject : prev ?? rows[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && PROJECT_TABS.includes(requestedTab as ProjectTab)) {
      setActiveTab(requestedTab as ProjectTab);
    }
    void reload();
  }, [router, reload]);

  const selected = useMemo(() => projects.find(p => p.id === selectedId) ?? projects[0] ?? null, [projects, selectedId]);

  useEffect(() => {
    if (!selected) {
      setTimeline([]);
      setRisks([]);
      setDocuments([]);
      return;
    }
    void fetchProjectTimeline(selected.id).then(setTimeline);
    void fetchProjectRisks(selected.id).then(setRisks);
    void fetchProjectDocuments(selected.id).then(setDocuments);
  }, [selected]);

  useEffect(() => {
    void fetchVendors().then(setVendors);
  }, []);

  if (!user) return null;

  const active = projects.filter(p => !["sold", "passed"].includes(p.status));
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget_total ?? 0), 0);
  const totalActual = projects.reduce((sum, p) => sum + Number(p.actual_spend ?? 0), 0);
  const openRisks = risks.filter(r => r.status === "open" || r.status === "monitoring");
  const projectTabs: { id: ProjectTab; label: string; count: number }[] = [
    { id: "overview", label: "Overview", count: selected ? 1 : 0 },
    { id: "risks", label: "Risks", count: openRisks.length },
    { id: "documents", label: "Documents", count: documents.length },
    { id: "vendors", label: "Vendors", count: vendors.length },
    { id: "timeline", label: "Timeline", count: timeline.length },
  ];

  const addRisk = async () => {
    if (!selected || !riskDraft.title.trim()) return;
    const { data, error } = await createProjectRisk({
      project_id: selected.id,
      title: riskDraft.title,
      likelihood: riskDraft.likelihood,
      impact: riskDraft.impact,
      mitigation: riskDraft.mitigation,
      owner: riskDraft.owner,
      next_review_date: riskDraft.next_review_date,
    }, user);
    if (error) { setMessage(error); return; }
    if (data) setRisks(prev => [data, ...prev]);
    setRiskDraft({ title: "", likelihood: "medium", impact: "medium", mitigation: "", owner: "", next_review_date: "" });
    setMessage("Project risk added.");
  };

  const addDocument = async () => {
    if (!selected || !docDraft.title.trim()) return;
    const { data, error } = await createProjectDocument({
      project_id: selected.id,
      title: docDraft.title,
      category: docDraft.category,
      url: docDraft.url,
      notes: docDraft.notes,
    }, user);
    if (error) { setMessage(error); return; }
    if (data) setDocuments(prev => [data, ...prev]);
    setDocDraft({ title: "", category: "Due Diligence", url: "", notes: "" });
    setMessage("Project document linked.");
  };

  const addVendor = async () => {
    if (!vendorDraft.name.trim()) return;
    const { data, error } = await createVendor(vendorDraft, user);
    if (error) { setMessage(error); return; }
    if (data) setVendors(prev => [data, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    setVendorDraft({ name: "", company: "", role: "Contractor", phone: "", email: "", reliability: "", pricing_notes: "", general_notes: "" });
    setMessage("Vendor added.");
  };

  const setRiskStatus = async (risk: ProjectRisk, status: RiskStatus) => {
    const { error } = await updateProjectRiskStatus(risk.id, status, user);
    if (error) { setMessage(error); return; }
    setRisks(prev => prev.map(r => r.id === risk.id ? { ...r, status, updated_at: new Date().toISOString(), updated_by: user } : r));
    setMessage(`Risk marked ${statusLabel(status)}.`);
  };

  return (
    <div className="projects-root" style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={eyebrow}>Assets</p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
            Project command
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.66, fontSize: 14, maxWidth: 680 }}>
            Approved deals become operating records here: budget, risk, next step, source packet, and timeline in one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => router.push("/operations")} style={secondaryButton}>Operations</button>
          <button onClick={() => router.push("/tracker")} style={secondaryButton}>Money</button>
          <button onClick={() => router.push("/deals")} style={primaryButton}>Deal Reviews</button>
        </div>
      </header>

      {message && (
        <div style={{
          border: "1px solid rgba(176,137,84,0.36)",
          background: "rgba(176,137,84,0.10)",
          color: "var(--obsidian)",
          borderRadius: 10,
          padding: "11px 13px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          fontSize: 13,
          lineHeight: 1.45,
        }}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ background: "transparent", border: "none", color: "var(--brass)", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Clear</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }} className="stat-grid">
        <Stat label="Projects" value={String(projects.length)} />
        <Stat label="Active" value={String(active.length)} />
        <Stat label="Budget" value={money(totalBudget)} />
        <Stat label="Actual spend" value={money(totalActual)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 18 }} className="project-workspace">
        <aside style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={sectionTitle}>Portfolio</h2>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{projects.length} records</span>
          </div>
          {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</p>}
          {!loading && projects.length === 0 && (
            <div>
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>
                No projects yet. Convert an approved deal packet to create the first project record.
              </p>
              <button onClick={() => router.push("/deals")} style={secondaryButton}>Go to Deal Reviews</button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(project => {
              const isActive = selected?.id === project.id;
              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedId(project.id)}
                  style={{
                    textAlign: "left",
                    background: isActive ? "rgba(176,137,84,0.16)" : "var(--surface)",
                    border: isActive ? "1px solid var(--brass)" : "1px solid var(--fog)",
                    borderRadius: 8,
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: "var(--obsidian)" }}>{project.name}</strong>
                    <span style={pill}>{statusLabel(project.status)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.66 }}>
                    {project.address || project.parcel_id || "Location pending"}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!selected ? (
            <section style={panel}>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Select a project to view the operating record.</p>
            </section>
          ) : (
            <>
              <nav className="project-tabs" aria-label="Project record sections">
                {projectTabs.map(tab => (
                  <ProjectTabButton
                    key={tab.id}
                    label={tab.label}
                    count={tab.count}
                    active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </nav>

              {activeTab === "overview" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <p style={eyebrowSmall}>{statusLabel(selected.property_type)} · {selected.strategy}</p>
                    <h2 style={{ fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 32, fontWeight: 500, lineHeight: 1.08 }}>
                      {selected.name}
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.68, marginTop: 6 }}>
                      {selected.address || selected.parcel_id || "Location pending"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={pillLarge}>{statusLabel(selected.status)}</span>
                    {selected.deal_id && (
                      <button onClick={() => router.push(`/opportunity?deal=${selected.deal_id}`)} style={secondaryButton}>
                        Source File
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} className="stat-grid">
                  <Stat label="Acquisition" value={money(selected.acquisition_price)} />
                  <Stat label="Target value" value={money(selected.target_exit_value)} />
                  <Stat label="Budget" value={money(selected.budget_total)} />
                  <Stat label="Actual spend" value={money(selected.actual_spend)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }} className="two-col">
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Next step</p>
                    <p style={bodyText}>{selected.next_step || "No next step recorded."}</p>
                  </div>
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Risk summary</p>
                    <pre style={preStyle}>{selected.risk_summary || "No major risks recorded yet."}</pre>
                  </div>
                </div>

                {selected.notes && (
                  <div style={{ ...subPanel, marginTop: 12 }}>
                    <p style={eyebrowSmall}>Source notes</p>
                    <pre style={preStyle}>{selected.notes}</pre>
                  </div>
                )}
              </section>
              )}

              {activeTab === "risks" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Risk register</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>{openRisks.length} open or monitoring</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 10, marginBottom: 10 }} className="risk-form">
                  <input placeholder="Risk title" value={riskDraft.title} onChange={e => setRiskDraft({ ...riskDraft, title: e.target.value })} />
                  <select value={riskDraft.likelihood} onChange={e => setRiskDraft({ ...riskDraft, likelihood: e.target.value as RiskLevel })}>
                    <option value="low">Low likelihood</option>
                    <option value="medium">Medium likelihood</option>
                    <option value="high">High likelihood</option>
                  </select>
                  <select value={riskDraft.impact} onChange={e => setRiskDraft({ ...riskDraft, impact: e.target.value as RiskLevel })}>
                    <option value="low">Low impact</option>
                    <option value="medium">Medium impact</option>
                    <option value="high">High impact</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 150px", gap: 10, marginBottom: 10 }} className="risk-form">
                  <input placeholder="Mitigation / next move" value={riskDraft.mitigation} onChange={e => setRiskDraft({ ...riskDraft, mitigation: e.target.value })} />
                  <input placeholder="Owner" value={riskDraft.owner} onChange={e => setRiskDraft({ ...riskDraft, owner: e.target.value })} />
                  <input type="date" value={riskDraft.next_review_date} onChange={e => setRiskDraft({ ...riskDraft, next_review_date: e.target.value })} />
                </div>
                <button onClick={addRisk} style={primaryButton}>Add Risk</button>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {risks.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No risks logged yet.</p>}
                  {risks.map(risk => (
                    <div key={risk.id} style={{ background: "var(--bone)", border: risk.impact === "high" ? "1px solid var(--obsidian)" : "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>{risk.title}</p>
                          <p style={{ fontSize: 12, color: "var(--muted)" }}>
                            {statusLabel(risk.likelihood)} likelihood · {statusLabel(risk.impact)} impact{risk.owner ? ` · ${risk.owner}` : ""}
                          </p>
                        </div>
                        <select value={risk.status} onChange={e => setRiskStatus(risk, e.target.value as RiskStatus)} style={{ maxWidth: 160 }}>
                          <option value="open">Open</option>
                          <option value="monitoring">Monitoring</option>
                          <option value="mitigated">Mitigated</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      {risk.mitigation && <p style={{ ...bodyText, marginTop: 6 }}>{risk.mitigation}</p>}
                      {risk.next_review_date && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Review {formatDate(risk.next_review_date)}</p>}
                    </div>
                  ))}
                </div>
              </section>
              )}

              {activeTab === "documents" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <h2 style={sectionTitle}>Project documents</h2>
                  <span style={comingSoonPill}>File upload coming soon</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, marginTop: 10 }} className="two-col">
                  <input placeholder="Document title" value={docDraft.title} onChange={e => setDocDraft({ ...docDraft, title: e.target.value })} />
                  <input placeholder="Category" value={docDraft.category} onChange={e => setDocDraft({ ...docDraft, category: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                  <input placeholder="URL or storage link" value={docDraft.url} onChange={e => setDocDraft({ ...docDraft, url: e.target.value })} />
                  <input placeholder="Notes" value={docDraft.notes} onChange={e => setDocDraft({ ...docDraft, notes: e.target.value })} />
                </div>
                <button onClick={addDocument} style={{ ...primaryButton, marginTop: 10 }}>Add Document</button>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {documents.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No documents linked yet.</p>}
                  {documents.map(doc => (
                    <div key={doc.id} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 10, color: "var(--brass)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>{doc.category}</p>
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: "var(--obsidian)", fontWeight: 700 }}>{doc.title}</a>
                      ) : (
                        <p style={{ fontSize: 14, color: "var(--obsidian)", fontWeight: 700 }}>{doc.title}</p>
                      )}
                      {doc.notes && <p style={{ ...bodyText, marginTop: 4 }}>{doc.notes}</p>}
                    </div>
                  ))}
                </div>
              </section>
              )}

              {activeTab === "vendors" && (
              <section style={panel}>
                <h2 style={sectionTitle}>Vendor directory</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10, marginTop: 10 }} className="risk-form">
                  <input placeholder="Name" value={vendorDraft.name} onChange={e => setVendorDraft({ ...vendorDraft, name: e.target.value })} />
                  <input placeholder="Company" value={vendorDraft.company} onChange={e => setVendorDraft({ ...vendorDraft, company: e.target.value })} />
                  <input placeholder="Role" value={vendorDraft.role} onChange={e => setVendorDraft({ ...vendorDraft, role: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                  <input placeholder="Phone" value={vendorDraft.phone} onChange={e => setVendorDraft({ ...vendorDraft, phone: e.target.value })} />
                  <input placeholder="Email" value={vendorDraft.email} onChange={e => setVendorDraft({ ...vendorDraft, email: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }} className="risk-form">
                  <input placeholder="Reliability notes" value={vendorDraft.reliability} onChange={e => setVendorDraft({ ...vendorDraft, reliability: e.target.value })} />
                  <input placeholder="Pricing notes" value={vendorDraft.pricing_notes} onChange={e => setVendorDraft({ ...vendorDraft, pricing_notes: e.target.value })} />
                  <input placeholder="General notes" value={vendorDraft.general_notes} onChange={e => setVendorDraft({ ...vendorDraft, general_notes: e.target.value })} />
                </div>
                <button onClick={addVendor} style={{ ...primaryButton, marginTop: 10 }}>Add Vendor</button>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 12 }} className="two-col">
                  {vendors.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No vendors yet.</p>}
                  {vendors.slice(0, 8).map(vendor => (
                    <div key={vendor.id} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 14, color: "var(--obsidian)", fontWeight: 700 }}>{vendor.name}</p>
                      <p style={{ fontSize: 12, color: "var(--muted)" }}>{vendor.role}{vendor.company ? ` · ${vendor.company}` : ""}</p>
                      {(vendor.phone || vendor.email) && <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.72 }}>{[vendor.phone, vendor.email].filter(Boolean).join(" · ")}</p>}
                    </div>
                  ))}
                </div>
              </section>
              )}

              {activeTab === "timeline" && (
              <section style={panel}>
                <h2 style={sectionTitle}>Timeline</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {timeline.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No timeline events yet.</p>}
                  {timeline.map(event => (
                    <div key={event.id} style={{ borderTop: "1px solid var(--fog)", paddingTop: 10 }}>
                      <p style={{ fontSize: 12, color: "var(--muted)" }}>{formatDate(event.event_date)}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)" }}>{event.title}</p>
                      {event.detail && <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.72 }}>{event.detail}</p>}
                    </div>
                  ))}
                </div>
              </section>
              )}
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        .project-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 0 0 12px;
          scrollbar-width: thin;
        }
        @media (max-width: 900px) {
          .project-workspace { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 680px) {
          .projects-root { padding-top: 28px !important; }
          .stat-grid,
          .two-col,
          .risk-form {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function ProjectTabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 40,
        border: active ? "1px solid var(--obsidian)" : "1px solid var(--fog)",
        borderRadius: 999,
        background: active ? "var(--obsidian)" : "rgba(255,255,255,0.7)",
        color: active ? "var(--bone)" : "var(--ink)",
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{
        minWidth: 22,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        background: active ? "rgba(237,230,214,0.16)" : "var(--bone)",
        color: active ? "var(--bone)" : "var(--muted)",
        fontSize: 10,
        letterSpacing: 0,
      }}>
        {count}
      </span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
      <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "var(--obsidian)" }}>{value}</p>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "var(--brass)",
  fontWeight: 600,
  marginBottom: 8,
};

const eyebrowSmall: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--brass)",
  fontWeight: 700,
};

const panel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 18,
};

const subPanel: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 10,
  padding: 14,
};

const primaryButton: React.CSSProperties = {
  background: "var(--brass)",
  color: "var(--obsidian)",
  border: "none",
  borderRadius: 6,
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--brass)",
  border: "1px solid var(--brass)",
  borderRadius: 6,
  padding: "9px 14px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const pillLarge: React.CSSProperties = {
  ...pill,
  padding: "5px 10px",
};

const comingSoonPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "4px 9px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
};

const bodyText: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink)",
  opacity: 0.78,
  lineHeight: 1.55,
};

const preStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "var(--ink)",
  opacity: 0.78,
  whiteSpace: "pre-wrap",
  lineHeight: 1.55,
  margin: 0,
};
