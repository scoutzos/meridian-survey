import type { Survey } from "./surveys";

export const tiebreakerSurvey: Survey = {
  id: "tiebreaker-decisions",
  title: "Operating Agreement Final Open Questions",
  description:
    "Answer only the remaining operating agreement items that are not already settled by the decision-tier framework, current four-member structure, or deal approval rules.",
  categories: [
    {
      id: "tb-four-member-governance",
      name: "Final Decision Mechanics",
      description:
        "Set only the remaining mechanics that the approved decision tiers left open.",
      questions: [
        {
          id: "tb-4m-q5",
          text: "What signature and payment-processing thresholds should apply after a decision is already approved?",
          context:
            "The decision tiers already say what needs approval. This question only finalizes who can sign or release funds after approval.",
          priority: "critical",
          singleSelect: true,
          options: [
            "One authorized signer may process previously approved budgeted payments under $2,500; two signatures for $2,500-$10,000; all-member written approval above $10,000 or unbudgeted.",
            "Two authorized signatures are required for every payment, contract, wire, or bank document.",
            "Any two current members may sign after the expense or deal has been approved in writing.",
            "All four members are signers; all four must approve bank documents, contracts, wires, and payments.",
          ],
        },
        {
          id: "tb-4m-q6",
          text: "What response windows should apply to written decision notices?",
          context:
            "The decision-tier framework already requires written notice and says non-response cannot commit personal risk. This question only finalizes the timing.",
          priority: "critical",
          singleSelect: true,
          options: [
            "48 hours for routine decisions; 24 hours for urgent deal decisions; non-response counts as abstention if the notice includes the consequence.",
            "72 hours for routine decisions; 48 hours for urgent deal decisions; non-response counts as abstention if the notice includes the consequence.",
            "24 hours for all deal-related decisions; non-response counts as a no vote.",
            "No automatic response deadline; decisions wait until all four members respond or meet live.",
          ],
        },
      ],
    },
    {
      id: "tb-four-member-capital-risk",
      name: "Capital, Credit & Tax Roles",
      description:
        "Confirm the limits on required money, optional deal capacity, guarantees, and tax representation.",
      questions: [
        {
          id: "tb-4m-q8",
          text: "How should Year-1 required capital exposure be capped for each member?",
          context:
            "Section 24.2. Current documented capacity is Aaliyah: $45,000 cash + $5,000 credit; Courtney: $10,000 cash; Odessa: $5,000 cash + $5,000 credit; Tiffany: $5,000 cash + $5,000 credit. The agreement must separate required exposure from voluntary deal-specific capacity.",
          priority: "critical",
          singleSelect: true,
          options: [
            "$5,000 required cap per member in Year 1; anything above that is optional and deal-specific.",
            "$10,000 required cap per member in Year 1; anything above that is optional and deal-specific.",
            "No fixed required cap; each deal sets its own capital need and each member opts in or out in writing.",
            "Use each member's Schedule A capacity as the maximum Year-1 exposure, but no amount is committed without that member's written deal approval.",
          ],
        },
        {
          id: "tb-4m-q9",
          text: "How should Aaliyah's updated $50,000 capacity be treated in the agreement?",
          context:
            "This reflects the updated breakdown: $45,000 cash and $5,000 credit. The main issue is whether it is mandatory capital or voluntary capacity.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Treat it as voluntary single-deal capacity only; no obligation unless Aaliyah signs a Deal Approval Memo or written capital commitment.",
            "Treat $5,000 as required initial contribution and the remaining $45,000 as optional deal-specific capacity.",
            "Treat the full $50,000 as Aaliyah's required initial contribution due after signing.",
            "Treat $45,000 cash as a member loan commitment and $5,000 credit as guarantee capacity, both optional by deal.",
          ],
        },
        {
          id: "tb-4m-q10",
          text: "What personal guarantee rule should apply when lenders require guarantees?",
          context:
            "Section 9.2. Three current members selected equal guarantee exposure in the survey, but no member's personal guarantee should be imposed without written approval.",
          priority: "critical",
          singleSelect: true,
          options: [
            "No member is required to guarantee unless they approve in writing; if guarantees are used, exposure should be equalized as much as lender requirements allow.",
            "All qualifying members must guarantee equally if the deal is approved by the required vote.",
            "Only members who volunteer to guarantee do so, and guarantors receive a premium or larger deal participation interest.",
            "Avoid personal guarantees unless all four members unanimously approve the specific guarantee terms.",
          ],
        },
        {
          id: "tb-4m-q11",
          text: "Who should serve as Partnership Representative for IRS matters?",
          context:
            "Section 7.2. The Partnership Representative is the LLC's point of contact for partnership-level tax proceedings.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Designate the primary Co-Managing Member, with required notice to all members before tax positions are taken.",
            "Designate an outside CPA or tax attorney, paid by the company.",
            "Designate a current member with finance/admin responsibility, supported by the CPA.",
            "Appoint the representative each tax year by member vote.",
          ],
        },
      ],
    },
    {
      id: "tb-four-member-deal-metrics",
      name: "Deal Metrics & Budget Triggers",
      description:
        "Finalize the deal-specific numbers the operating agreement should require before offers, material changes, and exits.",
      questions: [
        {
          id: "tb-4m-q21",
          text: "What budget variance should trigger a new member vote?",
          context:
            "The deal framework says material budget changes require a Tier 3 vote, but the operating agreement still needs a specific dollar or percentage trigger.",
          priority: "critical",
          singleSelect: true,
          options: [
            "More than $5,000 or more than 10% above the approved budget, whichever is lower.",
            "More than $5,000 or more than 10% above the approved budget, whichever is higher.",
            "More than $2,500 above the approved budget for any deal.",
            "Set the variance trigger separately in each Deal Approval Memo.",
          ],
        },
        {
          id: "tb-4m-q22",
          text: "What minimum projected profit or margin should be required before Meridian approves a deal offer?",
          context:
            "The framework requires the expected profit to justify the time, capital, and risk, but the group still needs a starting rule for deal approval.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Minimum $15,000 projected profit or 15% margin, unless members approve a written exception.",
            "Minimum $20,000 projected profit or 20% margin, unless members approve a written exception.",
            "Minimum profit/margin is set by deal type in each Deal Approval Memo.",
            "No fixed minimum; members decide case-by-case using the Deal Approval Memo.",
          ],
        },
        {
          id: "tb-4m-q23",
          text: "What reserve should each Deal Approval Memo require?",
          context:
            "The operating agreement should say whether every deal must include a reserve before Meridian commits capital, credit, debt, or guarantees.",
          priority: "critical",
          singleSelect: true,
          options: [
            "At least 10% of the approved project budget.",
            "The greater of $5,000 or 10% of the approved project budget.",
            "Reserve amount is set case-by-case in each Deal Approval Memo.",
            "No required reserve unless the members require one for a specific deal.",
          ],
        },
        {
          id: "tb-4m-q24",
          text: "What project timeline rule should trigger renewed member review?",
          context:
            "The framework says timeline changes should trigger exit review, but the operating agreement still needs a practical standard.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Renewed review if the project is more than 30 days beyond the Deal Approval Memo timeline.",
            "Renewed review at 90 days for every active deal, then every 30 days until exit.",
            "Use default timelines by strategy: 90 days wholesale/assignment, 6 months rehab/flip, 12 months build, and deal-specific timelines for holds/refinances.",
            "Timeline review is set case-by-case in each Deal Approval Memo.",
          ],
        },
      ],
    },
    {
      id: "tb-four-member-exit-life-events",
      name: "Exit, Buyout & Life Events",
      description:
        "Set the unresolved timing and representative rules for transfers, incapacity, disability, and dissolution.",
      questions: [
        {
          id: "tb-4m-q12",
          text: "How long should Meridian have to exercise a right of first refusal on a member interest?",
          context:
            "Section 8.4. Two of four current members selected 30 days; the remaining responses split across other options.",
          priority: "critical",
          singleSelect: true,
          options: [
            "30 days after receiving all transfer terms.",
            "45 days after receiving all transfer terms.",
            "60 days after receiving all transfer terms.",
            "90 days after receiving all transfer terms.",
          ],
        },
        {
          id: "tb-4m-q13",
          text: "If a member is temporarily incapacitated, what voting authority should their designated representative have?",
          context:
            "Section 8.8. The representative is a POA holder or named representative, not automatically a member of the LLC.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Economic/protective matters only; operational, strategic, new-deal, amendment, and dissolution votes proceed without that member's vote.",
            "Full voting rights for up to six months, as if the incapacitated member voted directly.",
            "Routine operational votes only; major decisions wait or use deadlock rules.",
            "No representative voting; the member's vote is treated as absent until capacity returns.",
          ],
        },
        {
          id: "tb-4m-q14",
          text: "How should disability buy-sell insurance be handled?",
          context:
            "Section 8.8. Disability buyout obligations can create cash pressure if the company does not plan for funding.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Required after the first company deal closes; obtain quotes within 60 days and vote on coverage within 30 days.",
            "Required immediately after signing if coverage is available at reasonable premiums.",
            "Recommended, not required; review annually with the insurance broker.",
            "No disability insurance requirement; disability buyouts are paid over time if triggered.",
          ],
        },
        {
          id: "tb-4m-q15",
          text: "What vote should be required for voluntary dissolution?",
          context:
            "Section 21.2. Current responses did not produce a clean 3-of-4 majority, but most favored unanimous or near-unanimous consent.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Unanimous approval of all four members, except forced dissolution under the deadlock process.",
            "3 of 4 members, but only after completing or safely exiting active deals.",
            "3 of 4 members at any time, with debts paid and capital returned before final distributions.",
            "Unanimous approval while active deals exist; 3 of 4 if there are no active deals.",
          ],
        },
      ],
    },
    {
      id: "tb-four-member-conflicts-records",
      name: "Conflicts, Commissions & Records",
      description:
        "Resolve the remaining operating standards that prevent money, licensing, and conflict disputes.",
      questions: [
        {
          id: "tb-4m-q16",
          text: "What approval rule should apply when a member or member-owned business wants to be paid as a vendor?",
          context:
            "Section 11.2. Current responses split between at-or-below-market with unanimous approval and competitive bids.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Competitive bids from at least two qualified outside vendors, disclosure, interested-member recusal, and approval by disinterested members.",
            "At or below market rate, written disclosure, interested-member recusal, and unanimous approval by the other members.",
            "Competitive bids and at-or-below-market pricing, with approval by disinterested members.",
            "Member-vendor transactions are not allowed unless all four members approve an exception for a specific project.",
          ],
        },
        {
          id: "tb-4m-q17",
          text: "How should real estate commissions from company transactions be handled?",
          context:
            "Section 12.1. Current responses support overlapping concepts: commission to the LLC, split with the licensed member, and deal-by-deal treatment.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Commission belongs to the LLC as company revenue when the lead or transaction is company-sourced.",
            "Commission is split 50/50 between the licensed member and the LLC unless a Deal Approval Memo says otherwise.",
            "Deal Approval Memo decides commission treatment before the offer is made.",
            "Licensed member keeps the commission personally after full written disclosure before deal approval.",
          ],
        },
        {
          id: "tb-4m-q18",
          text: "What bookkeeping and records setup should the company use?",
          context:
            "Section 13.1. Current responses split between a designated member with shared accounting software and outside professional bookkeeping/CPA support.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Designated member keeps books in shared software; outside bookkeeper or CPA performs monthly reconciliation.",
            "Professional bookkeeper maintains records; all members have real-time or 48-hour inspection access.",
            "CPA firm maintains records, monthly reports, and open access for all members.",
            "Co-Managing Member maintains records until the company has enough activity to hire a bookkeeper.",
          ],
        },
      ],
    },
    {
      id: "tb-four-member-legal-standards",
      name: "Legal Standards & Member Protections",
      description:
        "Set the remaining protective provisions counsel should finalize before execution.",
      questions: [
        {
          id: "tb-4m-q19",
          text: "Should married members provide spousal consent or acknowledgment before signing?",
          context:
            "Section 18.1. Current responses did not produce a clean 3-of-4 majority.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Require spousal consent/acknowledgment for all married beneficial owners before signing.",
            "Require spousal consent only when a member's LLC interest is owned jointly or funded with marital assets.",
            "Recommend but do not require spousal consent.",
            "No spousal consent requirement; rely on transfer restrictions and divorce provisions.",
          ],
        },
        {
          id: "tb-4m-q20",
          text: "What fiduciary duty standard should apply among members?",
          context:
            "Section 19.1. Current responses remain split between duty of care only and letting Georgia counsel define the framework.",
          priority: "critical",
          singleSelect: true,
          options: [
            "Duty of care, duty of loyalty, good faith, and fair dealing, modified to allow outside real estate activity with disclosure.",
            "Duty of care only; no duty of loyalty, with conflicts handled by written disclosure and approval rules.",
            "Duty of care and limited duty of loyalty; no self-dealing and no misuse of company opportunities, but outside deals are allowed with disclosure.",
            "Let Georgia counsel define the fiduciary standard after reviewing the final management and outside-deal rules.",
          ],
        },
      ],
    },
  ],
};
