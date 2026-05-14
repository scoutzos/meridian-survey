"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchImportedLandLeads,
  fetchLandLeadBatches,
  type ImportedLandLead,
  type LandLeadBatch,
} from "@/lib/land-leads";
import { labelForStatus } from "@/lib/status-map";
import { categorizeForBulkSms } from "@/lib/bulk-sms";

type IconName = "folder" | "home" | "users" | "phone" | "package" | "filter" | "megaphone" | "document" | "user" | "plus" | "compass";

function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.75 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "folder":
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>;
    case "home":
      return <svg {...common}><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V10z" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "phone":
      return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1 .35 1.94.69 2.83a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.89.34 1.83.56 2.83.69A2 2 0 0 1 22 16.92z" /></svg>;
    case "package":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M12 3v18" /></svg>;
    case "document":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
    case "filter":
      return <svg {...common}><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" /></svg>;
    case "megaphone":
      return <svg {...common}><path d="M3 11v3a1 1 0 0 0 1 1h2l3.29 3.29a1 1 0 0 0 1.71-.71V6.41a1 1 0 0 0-1.71-.71L6 9H4a1 1 0 0 0-1 1z" /><path d="M11 6.41V17.59l6-6V12.41l-6-6z" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

type ListsView = "batches" | "properties" | "contacts" | "segments" | "campaigns";
type PropertyFilters = {
  county: string;
  state: string;
  acres: string;
  score: string;
  flags: string;
  search: string;
};

const LISTS_VIEWS: Array<{ value: ListsView; label: string; icon: IconName }> = [
  { value: "batches", label: "Batches", icon: "folder" },
  { value: "properties", label: "Properties", icon: "home" },
  { value: "contacts", label: "Contacts", icon: "users" },
  { value: "segments", label: "Segments", icon: "filter" },
  { value: "campaigns", label: "Campaigns", icon: "megaphone" },
];

export default function ListsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ListsView>("properties");
  const [importedLeads, setImportedLeads] = useState<ImportedLandLead[]>([]);
  const [leadBatches, setLeadBatches] = useState<LandLeadBatch[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<ImportedLandLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PropertyFilters>({
    county: "All Counties",
    state: "Georgia",
    acres: "Any",
    score: "Any",
    flags: "All",
    search: "",
  });

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    loadData();
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leads, batches] = await Promise.all([
        fetchImportedLandLeads(2000),
        fetchLandLeadBatches(50),
      ]);
      setImportedLeads(leads);
      setLeadBatches(batches);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalRecords = importedLeads.length;
    const uniqueContacts = new Set(importedLeads.map(lead => 
      `${lead.phone || lead.phone_2 || ""}|${lead.owner_name || ""}`.toLowerCase()
    )).size;
    const withPhone = importedLeads.filter(lead => lead.phone || lead.phone_2).length;
    const callBacks = importedLeads.filter(lead => 
      lead.next_follow_up_date && lead.next_follow_up_date <= new Date().toISOString().split('T')[0]
    ).length;
    const eligible = categorizeForBulkSms(importedLeads).eligible.length;

    return {
      batches: leadBatches.length,
      totalRecords,
      uniqueContacts,
      withPhone,
      callBacks,
      eligible,
    };
  }, [importedLeads, leadBatches]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    return importedLeads.filter(lead => {
      if (filters.county !== "All Counties" && lead.county !== filters.county) return false;
      if (filters.state !== "Georgia" && lead.state !== filters.state) return false;
      
      // Acres filter
      if (filters.acres !== "Any") {
        const acres = lead.acreage || 0;
        switch (filters.acres) {
          case "< 1": if (acres >= 1) return false; break;
          case "1-5": if (acres < 1 || acres > 5) return false; break;
          case "5+": if (acres < 5) return false; break;
        }
      }
      
      // Score filter
      if (filters.score !== "Any") {
        const score = lead.lead_score || 0;
        const minScore = parseInt(filters.score.replace("+", ""));
        if (score < minScore) return false;
      }

      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchable = [
          lead.property_address,
          lead.parcel_id,
          lead.owner_name,
          lead.county,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(search)) return false;
      }

      return true;
    });
  }, [importedLeads, filters]);

  // Get unique filter options
  const filterOptions = useMemo(() => {
    return {
      counties: Array.from(new Set(importedLeads.map(lead => lead.county).filter((c): c is string => !!c))).sort(),
      states: Array.from(new Set(importedLeads.map(lead => lead.state).filter((s): s is string => !!s))).sort(),
    };
  }, [importedLeads]);

  const updateFilter = (key: keyof PropertyFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (!user) return null;

  return (
    <div className="lists-page" style={{ 
      maxWidth: 1480, 
      margin: "0 auto", 
      padding: "82px 20px 100px",
      fontFamily: "var(--font-body)",
    }}>
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div>
            <h1 style={{ 
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--obsidian)",
              margin: 0,
            }}>
              Lists
            </h1>
            <p style={{ 
              color: "var(--muted)", 
              fontSize: 13, 
              marginTop: 6,
              margin: 0,
            }}>
              Browse imported batches, property records, contacts, segments, and campaign audiences.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={secondaryButton}>
              🔄 Export CSV
            </button>
            <button style={primaryButton}>
              📤 Upload List
            </button>
            <button style={secondaryButton}>
              ⚙️ Lists Settings
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid var(--fog)" }}>
          <div style={{ display: "flex", gap: 0 }}>
            {LISTS_VIEWS.map(view => (
              <button
                key={view.value}
                onClick={() => setActiveView(view.value)}
                style={{
                  background: activeView === view.value ? "var(--obsidian)" : "transparent",
                  border: "none",
                  borderRadius: "6px 6px 0 0",
                  color: activeView === view.value ? "var(--bone)" : "var(--muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                <Icon name={view.icon} size={15} color={activeView === view.value ? "var(--bone)" : "var(--brass)"} />
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(4, 1fr)", 
        gap: 16, 
        marginBottom: 24,
      }}>
        <StatCard 
          label="Property Records" 
          value={stats.totalRecords.toLocaleString()} 
          subtitle="Total imported" 
          icon="home"
        />
        <StatCard 
          label="Contacts" 
          value={stats.uniqueContacts.toLocaleString()} 
          subtitle="Unique owners" 
          icon="users"
        />
        <StatCard 
          label="With phone" 
          value={stats.withPhone.toLocaleString()} 
          subtitle="Can contact" 
          icon="phone"
        />
        <StatCard 
          label="Call backs" 
          value={stats.callBacks.toString()} 
          subtitle="Created" 
          icon="phone"
        />
      </div>

      {/* Content based on active view */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        {/* Main Content */}
        <main style={{ 
          background: "rgba(255,255,255,0.78)",
          border: "1px solid var(--fog)",
          borderRadius: 12,
          padding: 24,
        }}>
          {activeView === "properties" && (
            <PropertyRecordsView 
              properties={filteredProperties}
              filters={filters}
              filterOptions={filterOptions}
              updateFilter={updateFilter}
              onSelectProperty={setSelectedProperty}
              selectedProperty={selectedProperty}
              loading={loading}
            />
          )}
          
          {activeView === "batches" && (
            <BatchesView batches={leadBatches} loading={loading} />
          )}
          
          {activeView === "contacts" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
              <h3>Contacts View</h3>
              <p>Contact management interface coming soon</p>
            </div>
          )}
          
          {activeView === "segments" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
              <h3>Segments View</h3>
              <p>Audience segmentation tools coming soon</p>
            </div>
          )}
          
          {activeView === "campaigns" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
              <h3>Campaigns View</h3>
              <p>Campaign management interface coming soon</p>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside style={{
          background: "rgba(255,255,255,0.78)",
          border: "1px solid var(--fog)",
          borderRadius: 12,
          padding: 20,
          alignSelf: "start",
          position: "sticky",
          top: 20,
        }}>
          {selectedProperty ? (
            <PropertyDetailsSidebar property={selectedProperty} />
          ) : (
            <div style={{ textAlign: "center", color: "var(--muted)" }}>
              <p style={{ fontSize: 13 }}>
                Select a property to view details, contact information, and quick actions.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Property Records View Component
function PropertyRecordsView({ 
  properties, 
  filters, 
  filterOptions, 
  updateFilter, 
  onSelectProperty,
  selectedProperty,
  loading 
}: {
  properties: ImportedLandLead[];
  filters: PropertyFilters;
  filterOptions: { counties: string[]; states: string[] };
  updateFilter: (key: keyof PropertyFilters, value: string) => void;
  onSelectProperty: (property: ImportedLandLead) => void;
  selectedProperty: ImportedLandLead | null;
  loading: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ 
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--obsidian)",
          margin: 0,
        }}>
          Property Records
        </h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {properties.length.toLocaleString()} records
        </span>
      </div>

      {/* Filters */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(6, 1fr)", 
        gap: 12, 
        marginBottom: 20,
      }}>
        <FilterSelect 
          label="County"
          value={filters.county}
          options={["All Counties", ...filterOptions.counties]}
          onChange={(value) => updateFilter("county", value)}
        />
        <FilterSelect 
          label="State"
          value={filters.state}
          options={["All States", ...filterOptions.states]}
          onChange={(value) => updateFilter("state", value)}
        />
        <FilterSelect 
          label="Acres"
          value={filters.acres}
          options={["Any", "< 1", "1-5", "5+"]}
          onChange={(value) => updateFilter("acres", value)}
        />
        <FilterSelect 
          label="Score"
          value={filters.score}
          options={["Any", "60+", "70+", "80+"]}
          onChange={(value) => updateFilter("score", value)}
        />
        <FilterSelect 
          label="Flags"
          value={filters.flags}
          options={["All", "Tax Delinquent", "Out of State", "No HOA"]}
          onChange={(value) => updateFilter("flags", value)}
        />
        <SearchInput 
          placeholder="Search APN or address..."
          value={filters.search}
          onChange={(value) => updateFilter("search", value)}
        />
      </div>

      {/* Property Table */}
      <div style={{ 
        border: "1px solid var(--fog)", 
        borderRadius: 8, 
        overflow: "hidden",
        background: "var(--surface)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ 
              background: "rgba(12,15,13,0.04)",
              borderBottom: "1px solid var(--fog)",
            }}>
              <th style={tableHeader}>Property Address</th>
              <th style={tableHeader}>County</th>
              <th style={tableHeader}>Acres</th>
              <th style={tableHeader}>Score</th>
              <th style={tableHeader}>Flags</th>
              <th style={tableHeader}>Owner / Contact</th>
              <th style={tableHeader}>Status</th>
              <th style={tableHeader}>Linked Deal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ ...tableCell, textAlign: "center", color: "var(--muted)" }}>
                  Loading properties...
                </td>
              </tr>
            ) : properties.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...tableCell, textAlign: "center", color: "var(--muted)" }}>
                  No properties match the current filters
                </td>
              </tr>
            ) : (
              properties.slice(0, 25).map(property => (
                <PropertyRow 
                  key={property.id}
                  property={property}
                  isSelected={selectedProperty?.id === property.id}
                  onSelect={() => onSelectProperty(property)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginTop: 16,
        fontSize: 12,
        color: "var(--muted)",
      }}>
        <span>
          Showing 1-{Math.min(25, properties.length)} of {properties.length.toLocaleString()} properties
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <span>Page 1 of 1</span>
          <button style={paginationButton}>‹</button>
          <button style={paginationButton}>›</button>
        </div>
      </div>
    </div>
  );
}

// Property Row Component
function PropertyRow({ 
  property, 
  isSelected, 
  onSelect 
}: { 
  property: ImportedLandLead; 
  isSelected: boolean;
  onSelect: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "interested": return "#10b981";
      case "contacted": return "#f59e0b";
      case "new": return "#3b82f6";
      default: return "var(--muted)";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "var(--muted)";
  };

  return (
    <tr 
      onClick={onSelect}
      style={{ 
        background: isSelected ? "rgba(176,137,84,0.12)" : "transparent",
        borderBottom: "1px solid var(--fog)",
        cursor: "pointer",
      }}
    >
      <td style={tableCell}>
        <div>
          <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>
            {property.property_address || "No address"}
          </strong>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {property.parcel_id || "No APN"}
          </div>
        </div>
      </td>
      <td style={tableCell}>{property.county || "—"}</td>
      <td style={tableCell}>{property.acreage ? `${property.acreage} ac` : "—"}</td>
      <td style={{ ...tableCell, color: getScoreColor(property.lead_score || 0), fontWeight: 700 }}>
        {property.lead_score || 0}
      </td>
      <td style={tableCell}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {property.tax_delinquent && (
            <span style={flagChip}>Tax Due</span>
          )}
          {property.owner_out_of_state && (
            <span style={flagChip}>Out of State</span>
          )}
          {property.in_hoa === false && (
            <span style={flagChip}>No HOA</span>
          )}
        </div>
      </td>
      <td style={tableCell}>
        <div>
          <strong style={{ color: "var(--obsidian)", fontSize: 12 }}>
            {property.owner_name || "Owner unknown"}
          </strong>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {property.phone || property.phone_2 || "No phone"}
          </div>
        </div>
      </td>
      <td style={tableCell}>
        <span style={{
          ...statusBadge,
          backgroundColor: `${getStatusColor(property.status)}20`,
          color: getStatusColor(property.status),
        }}>
          {labelForStatus(property.status)}
        </span>
      </td>
      <td style={tableCell}>
        {property.deal_id ? (
          <button style={linkButton}>
            Deal-{property.deal_id.slice(-6).toUpperCase()}
          </button>
        ) : (
          <span style={{ color: "var(--muted)" }}>—</span>
        )}
      </td>
    </tr>
  );
}

// Property Details Sidebar
function PropertyDetailsSidebar({ property }: { property: ImportedLandLead }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ 
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 500,
          color: "var(--obsidian)",
          margin: 0,
        }}>
          Selected Property
        </h3>
        <span style={{ fontSize: 12, color: "var(--brass)" }}>
          New
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ 
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 500,
          color: "var(--obsidian)",
          margin: 0,
        }}>
          {property.parcel_id || "R5123 032"}
        </h4>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0 0" }}>
          {property.property_address || "123 Main St"}<br />
          {property.city}, {property.state} {property.zip}
        </p>
      </div>

      {/* Property Details */}
      <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <DetailRow label="County" value={property.county || "Chatham"} />
        <DetailRow label="Acres" value={property.acreage ? `${property.acreage}` : "1.24"} />
        <DetailRow label="Score" value={(property.lead_score || 92).toString()} />
        <DetailRow label="Land Use" value="Residential Vacant" />
        <DetailRow label="Zoning" value="R-1" />
        <DetailRow label="Tax Status" value="Delinquent" />
      </div>

      {/* Owner Info */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Primary Owner / Contact
        </h4>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>
            {property.owner_name || "Maria Johnson"}
          </strong>
          <div style={{ fontSize: 11, color: "var(--brass)", marginTop: 2 }}>
            Confirmed
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          {property.phone || property.phone_2 || "(912) 555-0123"}<br />
          {property.email || "maria.johnson@email.com"}
        </p>
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0 0" }}>
          Owner of 3 properties
        </p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gap: 8 }}>
        <button style={primaryButton}>📞 View Contact</button>
        <button style={secondaryButton}>📋 Open Property Record</button>
        <button style={secondaryButton}>📄 Create Packet</button>
        <button style={secondaryButton}>➕ Add to Segment</button>
      </div>

      {/* Contact Eligibility */}
      <div style={{ 
        marginTop: 20, 
        padding: 12, 
        background: "rgba(16,185,129,0.08)",
        border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: 8,
      }}>
        <h4 style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Phone Eligibility
        </h4>
        <div style={{ display: "grid", gap: 4 }}>
          <EligibilityRow label="Textable" value="✓ Testable" />
          <EligibilityRow label="DNC Status" value="Not on DNC" />
          <EligibilityRow label="Consent Status" value="On File" />
        </div>
      </div>
    </div>
  );
}

// Utility Components
function StatCard({ label, value, subtitle, icon }: { 
  label: string; 
  value: string; 
  subtitle: string; 
  icon: IconName;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.78)",
      border: "1px solid var(--fog)",
      borderRadius: 12,
      padding: 20,
      textAlign: "center",
    }}>
      <div style={{ marginBottom: 8 }}>
        <Icon name={icon} size={24} color="var(--brass)" />
      </div>
      <h3 style={{ 
        fontSize: 24, 
        fontWeight: 700, 
        color: "var(--obsidian)", 
        margin: "0 0 4px 0",
      }}>
        {value}
      </h3>
      <p style={{ 
        fontSize: 13, 
        color: "var(--obsidian)", 
        fontWeight: 600,
        margin: "0 0 4px 0",
      }}>
        {label}
      </p>
      <p style={{ 
        fontSize: 11, 
        color: "var(--muted)", 
        margin: 0,
      }}>
        {subtitle}
      </p>
    </div>
  );
}

function FilterSelect({ 
  label, 
  value, 
  options, 
  onChange 
}: { 
  label: string; 
  value: string; 
  options: string[]; 
  onChange: (value: string) => void; 
}) {
  return (
    <div>
      <label style={{ 
        display: "block", 
        fontSize: 11, 
        fontWeight: 600, 
        color: "var(--muted)", 
        marginBottom: 4,
      }}>
        {label}
      </label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function SearchInput({ 
  placeholder, 
  value, 
  onChange 
}: { 
  placeholder: string; 
  value: string; 
  onChange: (value: string) => void; 
}) {
  return (
    <div>
      <label style={{ 
        display: "block", 
        fontSize: 11, 
        fontWeight: 600, 
        color: "var(--muted)", 
        marginBottom: 4,
      }}>
        Search
      </label>
      <input 
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <strong style={{ fontSize: 12, color: "var(--obsidian)" }}>{value}</strong>
    </div>
  );
}

function EligibilityRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#10b981" }}>{label}</span>
      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function BatchesView({ batches, loading }: { batches: LandLeadBatch[]; loading: boolean }) {
  return (
    <div>
      <h2 style={{ 
        fontFamily: "var(--font-display)",
        fontSize: 22,
        fontWeight: 500,
        color: "var(--obsidian)",
        margin: "0 0 20px 0",
      }}>
        List Batches
      </h2>
      
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
          Loading batches...
        </div>
      ) : batches.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
          <h3>No batches found</h3>
          <p>Upload your first CSV to get started</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {batches.map(batch => (
            <div key={batch.id} style={{
              background: "rgba(255,255,255,0.6)",
              border: "1px solid var(--fog)",
              borderRadius: 8,
              padding: 16,
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--obsidian)", margin: 0 }}>
                    {batch.campaign_source || batch.original_filename || "Imported List"}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0 0" }}>
                    {batch.original_filename} • Uploaded {new Date(batch.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span style={{ 
                  fontSize: 10, 
                  padding: "4px 8px", 
                  background: "rgba(16,185,129,0.12)",
                  color: "#10b981",
                  borderRadius: 12,
                  fontWeight: 600,
                }}>
                  COMPLETED
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
                <span><strong>{batch.row_count || 0}</strong> rows</span>
                <span><strong>0</strong> leads</span>
                <span><strong>0</strong> textable</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Styles
const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "transparent",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-body)",
  background: "var(--surface)",
  color: "var(--ink)",
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
};

const tableHeader: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const tableCell: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--fog)",
  fontSize: 12,
  color: "var(--ink)",
  verticalAlign: "top",
};

const statusBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const flagChip: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  background: "rgba(176,137,84,0.12)",
  border: "1px solid rgba(176,137,84,0.3)",
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 600,
  color: "var(--obsidian)",
};

const linkButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--brass)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  textDecoration: "underline",
  padding: 0,
};

const paginationButton: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--fog)",
  borderRadius: 4,
  color: "var(--obsidian)",
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 8px",
};