export type DecisionStatus = "confirmed" | "tabled" | "remaining";

export interface Decision {
  id: string;
  questionId: string | null;
  category: string;
  topic: string;
  status: DecisionStatus;
  finalAnswer: string | null;
  meetingDate: string | null;
  notes: string | null;
}

export const decisions: Decision[] = [
  // ===== CONFIRMED (March 26 Meeting) =====
  { id: "d1", questionId: "0-0", category: "Vision & Alignment", topic: "Vision & Goals", status: "confirmed", finalAnswer: "Build a few houses together for experience, create a 2-3 deal pipeline. Flexible long-term — could grow bigger or serve as a stepping stone.", meetingDate: "2026-03-26", notes: null },
  { id: "d2", questionId: "0-3", category: "Vision & Alignment", topic: "Time Commitment", status: "confirmed", finalAnswer: "5-10 hours/week with flexibility for personal schedules.", meetingDate: "2026-03-26", notes: null },
  { id: "d3", questionId: "1-0", category: "Ownership & Membership", topic: "Ownership Structure", status: "confirmed", finalAnswer: "Equal ownership (16.67% each) in the LLC. Deal-level profit splits based on individual contribution to each deal.", meetingDate: "2026-03-26", notes: null },
  { id: "d4", questionId: null, category: "Ownership & Membership", topic: "Deal Structure", status: "confirmed", finalAnswer: "Each deal operates with its own terms within the LLC — separate contribution/profit structure per deal.", meetingDate: "2026-03-26", notes: null },
  { id: "d5", questionId: null, category: "Ownership & Membership", topic: "Equity Partners on Deals", status: "confirmed", finalAnswer: "Outside equity partners can join individual deals without amending the LLC. Handled via deal-level agreements.", meetingDate: "2026-03-26", notes: null },
  { id: "d6", questionId: "1-1", category: "Ownership & Membership", topic: "Adding New Members", status: "confirmed", finalAnswer: "Supermajority (⅔) approval required.", meetingDate: "2026-03-26", notes: null },
  { id: "d7", questionId: "1-2", category: "Ownership & Membership", topic: "Transferring Ownership", status: "confirmed", finalAnswer: "Unanimous consent required. Group has right of first refusal.", meetingDate: "2026-03-26", notes: null },
  { id: "d8", questionId: "1-3", category: "Ownership & Membership", topic: "Death / Survivorship", status: "confirmed", finalAnswer: "Heirs receive cash (FMV buyout), not a seat at the table. No voting rights for heirs unless group approves.", meetingDate: "2026-03-26", notes: null },
  { id: "d9", questionId: "2-0", category: "Capital Contributions", topic: "Capital Contributions", status: "confirmed", finalAnswer: "Variable based on individual capacity. Each member bringing their number to April 2 meeting.", meetingDate: "2026-03-26", notes: null },
  { id: "d10", questionId: "3-0", category: "Management & Decision Making", topic: "Managing Members", status: "confirmed", finalAnswer: "Three Co-Managing Members: Courtney, Aaliyah, and Raquel. No extra compensation.", meetingDate: "2026-03-26", notes: null },
  { id: "d11", questionId: null, category: "Management & Decision Making", topic: "Attorney & Operating Agreement", status: "confirmed", finalAnswer: "LegalShield attorney (Deming Parker, Atlanta) at $675 for full OA.", meetingDate: "2026-03-26", notes: "Replaced Jaryd Tamares ($1,500-$2,000)" },
  { id: "d12", questionId: null, category: "Management & Decision Making", topic: "LLC Formation", status: "confirmed", finalAnswer: "Odessa handling formation. Pending: (1) attorney answer on LLC-as-member structure, (2) confirmed business address.", meetingDate: "2026-03-26", notes: null },
  { id: "d13", questionId: null, category: "Strategy", topic: "Deal Strategy", status: "confirmed", finalAnswer: "Dual approach: wholesale/flip for capital AND ready to strike on land deals. Target: construction underway by mid-June.", meetingDate: "2026-03-26", notes: null },
  { id: "d14", questionId: null, category: "Operations", topic: "Meeting Schedule", status: "confirmed", finalAnswer: "Wednesday nights at 7:30 PM ET. Next meeting: April 2, 2026.", meetingDate: "2026-03-26", notes: null },

  // ===== TABLED =====
  { id: "t1", questionId: "15-0", category: "Spousal Consent", topic: "Spousal Consent Language", status: "tabled", finalAnswer: null, meetingDate: "2026-03-26", notes: "Deferred to attorney answer on LLC-as-member structure. Peggee consulting LegalShield." },
  { id: "t2", questionId: "3-4", category: "Management & Decision Making", topic: "Signature Authority", status: "tabled", finalAnswer: null, meetingDate: "2026-03-26", notes: "Discussed briefly. Waiting for Tiffany's input." },
  { id: "t3", questionId: "3-3", category: "Management & Decision Making", topic: "Voting Thresholds", status: "tabled", finalAnswer: null, meetingDate: "2026-03-26", notes: "Framework discussed but not formally confirmed." },
  { id: "t4", questionId: null, category: "Financial Transparency", topic: "Credit Scores", status: "tabled", finalAnswer: null, meetingDate: "2026-03-26", notes: "Not discussed. Carry to April 2 meeting. Minimum 680 required." },

  // ===== REMAINING (Not Yet Discussed) =====
  { id: "r1", questionId: "0-1", category: "Vision & Alignment", topic: "Primary Personal Goal", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 6/6 chose learn hands-on" },
  { id: "r2", questionId: "0-2", category: "Vision & Alignment", topic: "Risk Tolerance", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 chose moderate" },
  { id: "r3", questionId: "0-4", category: "Vision & Alignment", topic: "Exit Triggers", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 6/6 lack of progress, 5/6 broken trust" },
  { id: "r4", questionId: "2-1", category: "Capital Contributions", topic: "Acceptable Contribution Forms", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 chose cash, property, services, credit" },
  { id: "r5", questionId: "2-2", category: "Capital Contributions", topic: "Missed Contributions", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 chose 30-day grace then reduce ownership" },
  { id: "r6", questionId: "2-3", category: "Capital Contributions", topic: "Capital Calls", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 chose optional with preferred return" },
  { id: "r7", questionId: "3-1", category: "Management & Decision Making", topic: "Spending Authority Threshold", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: split — needs discussion" },
  { id: "r8", questionId: "3-2", category: "Management & Decision Making", topic: "Voting Structure", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: split 3/3" },
  { id: "r9", questionId: "4-0", category: "Profits, Distributions & Losses", topic: "Profit Distribution Method", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 deal-by-deal waterfall" },
  { id: "r10", questionId: "4-1", category: "Profits, Distributions & Losses", topic: "Distribution Frequency", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 after each deal closes" },
  { id: "r11", questionId: "4-2", category: "Profits, Distributions & Losses", topic: "Loss Allocation", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 pro-rata by ownership" },
  { id: "r12", questionId: "5-0", category: "Exit & Buyout Provisions", topic: "Minimum Commitment Period", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 cannot exit during active deals" },
  { id: "r13", questionId: "5-1", category: "Exit & Buyout Provisions", topic: "Departing Interest Valuation", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 negotiation" },
  { id: "r14", questionId: "5-2", category: "Exit & Buyout Provisions", topic: "Right of First Refusal", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: split — needs discussion" },
  { id: "r15", questionId: "5-3", category: "Exit & Buyout Provisions", topic: "Buyout Payment Timeline", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 case-by-case" },
  { id: "r16", questionId: "5-4", category: "Exit & Buyout Provisions", topic: "Involuntary Removal Grounds", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 fraud/criminal, 4/6 failure after notice" },
  { id: "r17", questionId: "5-5", category: "Exit & Buyout Provisions", topic: "Death of a Member", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Partially discussed — heirs get cash, not seat" },
  { id: "r18", questionId: "5-6", category: "Exit & Buyout Provisions", topic: "Incapacitation", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 six-month grace then buyout" },
  { id: "r19", questionId: "5-7", category: "Exit & Buyout Provisions", topic: "Divorce Provisions", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 case-by-case with group vote" },
  { id: "r20", questionId: "6-0", category: "Financing & Debt", topic: "Debt Strategy", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 6/6 leverage, 5/6 hard money + conventional" },
  { id: "r21", questionId: "6-1", category: "Financing & Debt", topic: "Personal Guarantees", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 all guarantee equally" },
  { id: "r22", questionId: "7-0", category: "Banking & Financial Controls", topic: "Spending Controls", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 single sig for budgeted, group for unbudgeted" },
  { id: "r23", questionId: "8-0", category: "Conflicts of Interest", topic: "Outside Deals", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 allowed with disclosure" },
  { id: "r24", questionId: "8-1", category: "Conflicts of Interest", topic: "Member as Vendor", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: split 3/3" },
  { id: "r25", questionId: "9-0", category: "Real Estate Commissions", topic: "Commission Handling", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: split — needs discussion" },
  { id: "r26", questionId: "10-0", category: "Dissolution", topic: "Dissolution Vote & Process", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: split across options" },
  { id: "r27", questionId: "11-0", category: "Dispute Resolution", topic: "Dispute Process", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 mediation then arbitration" },
  { id: "r28", questionId: "12-0", category: "OA Administration", topic: "Review Schedule & Amendments", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 3/6 semi-annually then annually" },
  { id: "r29", questionId: "13-0", category: "Non-Compete", topic: "Post-Exit Restrictions", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 no restrictions" },
  { id: "r30", questionId: "14-0", category: "Tax & Distributions", topic: "Tax Distributions", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 3/6 annual before K-1s" },
  { id: "r31", questionId: "16-0", category: "Intellectual Property", topic: "IP Ownership", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 LLC owns all" },
  { id: "r32", questionId: "17-0", category: "Deadlock Provisions", topic: "Deadlock Resolution", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 mediation + advisor" },
  { id: "r33", questionId: "18-0", category: "Fiduciary Duties", topic: "Fiduciary Standard", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 3/3 split" },
  { id: "r34", questionId: "19-0", category: "Insurance", topic: "Insurance Coverage", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 broker recommendation" },
  { id: "r35", questionId: "20-0", category: "Books & Records", topic: "Financial Records", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 3/3 split" },
  { id: "r36", questionId: "21-0", category: "Indemnification", topic: "Indemnification", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 all members except gross negligence" },
  { id: "r37", questionId: "22-0", category: "Working Style", topic: "Conflict Resolution Style", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 4/6 directly but privately" },
  { id: "r38", questionId: "22-1", category: "Working Style", topic: "Accountability", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 hold me accountable" },
  { id: "r39", questionId: "23-0", category: "Financial Transparency", topic: "Sharing Financial Info", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 5/6 only LLC-relevant" },
  { id: "r40", questionId: "23-1", category: "Financial Transparency", topic: "Max Personal Risk Year 1", status: "remaining", finalAnswer: null, meetingDate: null, notes: "Survey: 3/6 $10K, 3/6 $5K" },
];
