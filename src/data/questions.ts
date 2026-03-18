export interface Question {
  text: string;
  options?: string[];
  priority: "critical" | "important" | "recommended";
}

export interface Category {
  name: string;
  questions: Question[];
}

export const categories: Category[] = [
  { name: "Vision & Alignment", questions: [
    { text: "What is your vision for Meridian Collective — what does success look like in 1 year and 3-5 years?",
      priority: "critical",
      options: ["Completed first profitable flip, building pipeline", "2-3 deals done with consistent profits and a rental portfolio started", "Established brand with multiple completed builds in metro Atlanta", "Generational wealth vehicle — each member financially free in 5 years", "Full-service real estate firm (build, manage, sell)"] },
    { text: "What is your PRIMARY personal goal for joining this group?",
      priority: "critical",
      options: ["Build generational wealth through real estate", "Learn the development process hands-on with a supportive team", "Generate active income through flips and builds", "Create passive income through rental properties", "Build something bigger than I could alone — leverage the collective"] },
    { text: "What is your risk tolerance for this venture?",
      priority: "critical",
      options: ["Conservative — protect capital first, grow slowly", "Moderate — willing to take calculated risks with proper research", "Aggressive — move fast, take bigger swings for bigger returns", "Very conservative — I cannot afford to lose my investment"] },
    { text: "How many hours per week can you REALISTICALLY commit to Meridian Collective business?",
      priority: "critical",
      options: ["5-10 hours", "10-20 hours", "20-30 hours", "30+ hours (this is my primary focus)", "It varies — some weeks more, some weeks less"] },
    { text: "What would cause you to want to EXIT Meridian Collective?",
      priority: "critical",
      options: ["Consistent financial losses", "Trust being broken between members", "Lack of progress — no deals closing", "Personal financial circumstances changing", "Disagreements on direction that can't be resolved", "I can't see myself leaving — I'm fully committed"] },
  ]},
  { name: "Ownership & Membership Structure", questions: [
    { text: "How will ownership be structured — equal shares for all members, or weighted based on capital contribution, sweat equity, or a combination?",
      priority: "critical",
      options: ["Equal ownership for all members", "Weighted by capital contribution", "Weighted by time/effort/sweat equity", "Combination of capital and sweat equity", "To be determined based on each deal"] },
    { text: "Can new members be added in the future? If so, what vote is required?",
      priority: "critical",
      options: ["Yes, with unanimous approval of existing members", "Yes, with supermajority (2/3) approval", "Yes, with Managing Member approval only", "No, membership is closed"] },
    { text: "Can a member transfer or sell their ownership interest to someone outside the group?",
      priority: "critical",
      options: ["No outside transfers — must sell back to the group", "Only with unanimous consent of all members", "Allowed with majority approval", "Allowed freely after a minimum holding period"] },
    { text: "What happens to a member's interest if they pass away, become incapacitated, go through a divorce, or file for bankruptcy?",
      priority: "critical",
      options: ["Group has mandatory buyout right at fair market value in all cases", "Interest passes to estate/heirs with group approval; buyout right for divorce/bankruptcy", "Heir inherits economic interest only (no voting) unless group approves full membership", "Handle each situation case-by-case per the operating agreement provisions"] },
  ]},
  { name: "Capital Contributions", questions: [
    { text: "How much is each member contributing to start, and by what date?",
      priority: "critical",
      options: ["$5,000 each within 30 days", "$10,000 each within 30 days", "$25,000 each within 60 days", "$50,000 each within 90 days", "Variable amounts based on individual capacity"] },
    { text: "What forms of contribution are acceptable — cash only, or also property, services, or sweat equity?",
      priority: "critical",
      options: ["Cash only", "Cash and real property", "Cash, property, and documented services/sweat equity", "Any form with agreed-upon valuation by all members"] },
    { text: "What happens if a member cannot make their contribution on time?",
      priority: "critical",
      options: ["30-day grace period, then ownership percentage is reduced", "Automatic forfeiture of membership", "Treated as a loan from other members at agreed interest rate", "Remaining members cover the shortfall and adjust equity accordingly"] },
    { text: "If the LLC needs additional capital (capital call), what happens if someone can't or won't contribute?",
      priority: "critical",
      options: ["Mandatory — failure to contribute dilutes ownership", "Mandatory — non-contributing member's interest is reduced proportionally", "Optional — contributing members receive preferred return on extra capital", "Managing Member can authorize a loan instead of a capital call"] },
  ]},
  { name: "Management & Decision Making", questions: [
    { text: "Who will serve as Managing Member(s) and will they be compensated for their time?",
      priority: "critical",
      options: ["Single Managing Member, no extra compensation — part of membership", "Single Managing Member with a monthly management fee", "Two Co-Managing Members splitting duties, no extra pay", "Rotating Managing Member role (e.g., annually)"] },
    { text: "What is the dollar threshold that requires a group vote vs. what the Managing Member can decide alone?",
      priority: "critical",
      options: ["Managing Member can approve up to $5,000 independently", "Managing Member can approve up to $10,000 independently", "Managing Member can approve up to $25,000 independently", "All expenditures require group approval regardless of amount"] },
    { text: "How will voting work — one vote per member or weighted by ownership? How are ties resolved?",
      priority: "critical",
      options: ["One vote per member; Managing Member breaks ties", "Weighted by ownership percentage; table tied votes for 30 days", "One vote per member for operations, weighted for financial decisions", "One vote per member; neutral third-party mediator for ties"] },
    { text: "What decisions require simple majority, supermajority (2/3), and unanimous votes?",
      priority: "critical",
      options: ["Majority: day-to-day ops | Supermajority: major expenses, removing a member | Unanimous: new members, dissolution, amending OA", "Majority: all operational decisions | Supermajority: debt over $50K | Unanimous: dissolution and OA amendments only", "Everything requires supermajority except Managing Member's day-to-day authority", "Unanimous for all major decisions; Managing Member handles everything else"] },
    { text: "Who has signature authority on bank accounts and contracts?",
      priority: "critical",
      options: ["Managing Member only", "Any two members jointly", "Managing Member plus one other member", "All members have individual signature authority"] },
  ]},
  { name: "Profits, Distributions & Losses", questions: [
    { text: "How will profits be distributed — pro-rata by ownership, or is there a preferred return structure?",
      priority: "critical",
      options: ["Strictly pro-rata based on ownership percentage", "Preferred return (e.g., 8%) to capital contributors first, then pro-rata", "Preferred return to capital, then 70/30 split (members/managing member)", "Deal-by-deal waterfall based on each member's contribution to that deal"] },
    { text: "How frequently will distributions be made?",
      priority: "critical",
      options: ["Monthly", "Quarterly", "After each deal closes", "Annually", "Only when majority votes to distribute"] },
    { text: "How will losses be allocated among members?",
      priority: "critical",
      options: ["Pro-rata based on ownership percentage", "Equally among all members", "Allocated to members who approved the deal", "Based on capital account balances"] },
  ]},
  { name: "Exit & Buyout Provisions", questions: [
    { text: "Is there a minimum commitment period before a member can exit (e.g., 1-3 years)?",
      priority: "critical",
      options: ["No minimum — members can exit anytime", "1-year minimum commitment", "2-year minimum commitment", "3-year minimum commitment", "Cannot exit while active deals are in progress"] },
    { text: "How is a departing member's interest valued?",
      priority: "critical",
      options: ["Book value of capital account", "Independent third-party appraisal of all LLC assets", "Formula based on capital account plus share of unrealized gains", "Negotiation between departing member and remaining members"] },
    { text: "Does the group have right of first refusal before a member can sell to an outsider?",
      priority: "critical",
      options: ["Yes, 60-day right of first refusal", "Yes, 90-day right of first refusal", "Yes, 30-day right of first refusal", "No — departing member can sell to anyone with group approval"] },
    { text: "What is the buyout payment timeline?",
      priority: "critical",
      options: ["Lump sum within 90 days", "Installments over 12 months", "Installments over 24 months", "50% upfront, remainder over 12 months", "Negotiated case-by-case"] },
    { text: "What are the grounds for involuntary removal of a member?",
      priority: "critical",
      options: ["Fraud, embezzlement, or criminal conviction related to business", "Any felony conviction", "Consistent failure to fulfill responsibilities after written notice", "All of the above", "All of the above plus personal bankruptcy"] },
  ]},
  { name: "Financing & Debt", questions: [
    { text: "Is the group open to taking on debt for deals? What types of financing?",
      priority: "critical",
      options: ["Cash only — no debt", "Conventional financing only", "Hard money for flips, conventional for holds", "Leverage preferred — maximize returns with OPM"] },
    { text: "Will members be required to personally guarantee loans? Is everyone willing?",
      priority: "critical",
      options: ["Yes, all members guarantee equally", "Only Managing Member(s) guarantee, with compensation for the risk", "Guarantors rotate based on deal", "No personal guarantees — only non-recourse or asset-based lending"] },
  ]},
  { name: "Banking & Financial Controls", questions: [
    { text: "How many signatures are required for large payments, and what's the spending limit before group approval?",
      priority: "critical",
      options: ["Two signatures over $5,000; group approval over $5,000", "Two signatures over $10,000; group approval over $10,000", "Managing Member alone up to $10,000; two signatures and group approval above", "Single signature for budgeted items; group approval for all unbudgeted expenses"] },
  ]},
  { name: "Conflicts of Interest & Outside Deals", questions: [
    { text: "Can members pursue real estate deals outside of the LLC?",
      priority: "critical",
      options: ["No — all real estate activity must go through the LLC", "Yes, but only in markets/property types the LLC doesn't operate in", "Yes, but must disclose and offer to the LLC first (right of first offer)", "Yes, with full disclosure but no restrictions"] },
    { text: "Can a member do business with the LLC (contracting, lending, property management)?",
      priority: "critical",
      options: ["No — members cannot be vendors to the LLC", "Yes, at market rate with full written disclosure and majority approval", "Yes, at or below market rate with unanimous approval", "Yes, but must obtain competitive bids to prove fair pricing"] },
  ]},
  { name: "Real Estate Licenses & Commissions", questions: [
    { text: "When a licensed member represents the LLC in a transaction, who keeps the commission?",
      priority: "critical",
      options: ["Commission goes to the LLC as revenue", "Licensed member keeps their commission personally", "Split — half to LLC, half to licensed member", "Decided on a deal-by-deal basis"] },
  ]},
  { name: "Dissolution", questions: [
    { text: "What vote is required to dissolve the LLC, and how are assets distributed?",
      priority: "critical",
      options: ["Unanimous vote; pay debts then distribute pro-rata by ownership", "Supermajority (2/3); pay debts, return capital, then split remainder pro-rata", "Supermajority (3/4); liquidate everything and distribute cash pro-rata", "Unanimous; complete active projects first, then pay debts and distribute"] },
  ]},
  { name: "Dispute Resolution", questions: [
    { text: "How will the group resolve disputes — mediation, arbitration, or litigation?",
      priority: "critical",
      options: ["Mandatory mediation first, then binding arbitration", "Mandatory mediation first, then litigation if unresolved", "Binding arbitration only — no litigation", "No mandatory process — any member can pursue legal action"] },
  ]},
  { name: "Operating Agreement Administration", questions: [
    { text: "How often will the Operating Agreement be reviewed, and what vote is required to amend it?",
      priority: "critical",
      options: ["Annually; unanimous vote to amend", "Every 2 years; supermajority (2/3) to amend", "Only when triggered by a major event; unanimous to amend", "Semi-annually for first 2 years then annually; supermajority (3/4) to amend"] },
  ]},
  { name: "Confidentiality & Non-Compete", questions: [
    { text: "After a member leaves, are there non-compete or non-solicitation restrictions?",
      priority: "critical",
      options: ["12-month non-compete and non-solicitation", "24-month non-compete and non-solicitation", "Non-solicitation only (can't recruit members or take LLC relationships), no non-compete", "No restrictions after exit"] },
  ]},
  { name: "Working Style & Communication", questions: [
    { text: "How do you handle conflict or disagreement?",
      priority: "critical",
      options: ["Directly — address it head-on", "Directly but privately — pull the person aside", "I need time to process before addressing conflict", "I tend to avoid conflict and hope it resolves", "Through a mediator or neutral third party"] },
    { text: "Are you comfortable being held accountable by the group if you fall behind on commitments?",
      priority: "critical",
      options: ["Yes — hold me accountable, that's what I need", "Yes, but do it privately, not in front of everyone", "Yes, as long as accountability goes both ways", "I'd prefer to self-manage and report on my own progress"] },
  ]},
  { name: "Financial Transparency", questions: [
    { text: "Are you comfortable sharing your financial picture (credit score, debts, assets, income) with the group?",
      priority: "critical",
      options: ["Yes — full transparency is necessary for trust", "Yes, but only information directly relevant to the LLC", "I'd share with one designated person but not the whole group", "No — my personal finances are private, only share what's needed per deal"] },
    { text: "What is the maximum amount of personal money you are willing to put at risk in the first year?",
      priority: "critical",
      options: ["Up to $5,000", "Up to $10,000", "Up to $25,000", "Up to $50,000", "$50,000+", "I don't have extra capital right now"] },
  ]},
];

// NOTE: Full 270-question archive preserved in questions-full-archive.ts

export const MEMBERS = ["Courtney Mosely", "Odessa Patterson", "Raquel Twine", "Tiffany Stallworth", "Aaliyah Thomas", "Peggee"] as const;
export type Member = typeof MEMBERS[number];
