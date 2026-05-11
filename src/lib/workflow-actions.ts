import type { Deal, DealAgreement, DealAnalysis, DealDueDiligenceItem, DealVote } from "./deals";
import type { ImportedLandLead } from "./land-leads";
import type { CommunicationEvent } from "./communications";

export type WorkflowTone = "calm" | "hot" | "warn" | "success";

export type WorkflowAction = {
  label: string;
  title: string;
  detail: string;
  primary: string;
  tone: WorkflowTone;
  target: "lead" | "packet" | "communications" | "vote" | "agreement" | "diligence" | "disposition" | "project" | "file";
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getLeadNextAction(lead: ImportedLandLead): WorkflowAction {
  if (lead.sms_opt_status === "opted-out") {
    return {
      label: "Do Not Text",
      title: "Seller opted out",
      detail: "Keep SMS disabled. Log only non-text updates or research notes.",
      primary: "Log Note",
      tone: "warn",
      target: "lead",
    };
  }
  if (lead.status === "converted" || lead.deal_id) {
    return {
      label: "Converted",
      title: "Open the shared file",
      detail: "This lead already has a deal packet. Continue work from the opportunity file.",
      primary: "Open File",
      tone: "success",
      target: "file",
    };
  }
  if (!lead.phone && !lead.phone_2) {
    return {
      label: "Needs Phone",
      title: "Find a usable contact method",
      detail: "No phone is available. Research or skip-trace before outreach.",
      primary: "Log Research",
      tone: "calm",
      target: "lead",
    };
  }
  if (lead.status === "interested") {
    return {
      label: "Ready For Packet",
      title: "Build the member packet",
      detail: "Seller has shown interest. Confirm facts, summarize the ask, then submit for review.",
      primary: "Build Packet",
      tone: "hot",
      target: "packet",
    };
  }
  if (lead.last_sms_direction === "inbound") {
    return {
      label: "Seller Replied",
      title: "Reply or set the outcome",
      detail: "Answer the seller, mark the disposition, or convert if they want an offer.",
      primary: "Reply",
      tone: "hot",
      target: "communications",
    };
  }
  if (lead.next_follow_up_date) {
    const isDue = lead.next_follow_up_date <= todayIso();
    return {
      label: isDue ? "Follow-Up Due" : "Follow-Up Scheduled",
      title: isDue ? "Follow up with seller" : "Follow-up is already set",
      detail: `Next follow-up: ${lead.next_follow_up_date}.`,
      primary: isDue ? "Follow Up" : "Review",
      tone: isDue ? "hot" : "calm",
      target: "communications",
    };
  }
  if (lead.last_sms_direction === "outbound") {
    return {
      label: "Waiting On Seller",
      title: "Set the next follow-up",
      detail: `Last text sent ${lead.last_sms_at ? "recently" : "from this lead"}. Keep the queue from going stale.`,
      primary: "Set Follow-Up",
      tone: "calm",
      target: "lead",
    };
  }
  return {
    label: "Needs First Touch",
    title: "Start seller outreach",
    detail: "Start with SMS, a call attempt, or pass if the record is not usable.",
    primary: "Send First SMS",
    tone: "calm",
    target: "communications",
  };
}

export function getDealNextAction(args: {
  deal: Deal;
  analysis?: DealAnalysis | null;
  votes?: DealVote[];
  agreement?: DealAgreement | null;
  checklist?: DealDueDiligenceItem[];
  communications?: CommunicationEvent[];
  currentUser?: string | null;
  quorumNeeded?: number;
}): WorkflowAction {
  const { deal, currentUser } = args;
  const analysis = args.analysis ?? deal.analysis;
  const votes = args.votes ?? [];
  const checklist = args.checklist ?? [];
  const quorumNeeded = args.quorumNeeded ?? 4;
  const myVote = currentUser ? votes.find(vote => vote.member_name === currentUser) : null;
  const approvalVotes = votes.filter(vote => vote.vote === "make-offer" || vote.vote === "counter").length;
  const blockedDiligence = checklist.filter(item => item.status === "blocked").length;
  const agreementReady = args.agreement?.status === "approved" || args.agreement?.status === "signed";
  const hasSellerThread = (args.communications ?? []).length > 0;

  if (analysis?.missingInfo?.length) {
    return {
      label: "Needs Packet Review",
      title: "Confirm missing numbers before voting",
      detail: analysis.missingInfo.slice(0, 2).join(" · "),
      primary: "Review Packet",
      tone: "warn",
      target: "packet",
    };
  }
  if (!hasSellerThread && !deal.submission_summary) {
    return {
      label: "Needs Context",
      title: "Attach communication or VA summary",
      detail: "Members need seller context before making a clean decision.",
      primary: "Review Communications",
      tone: "warn",
      target: "communications",
    };
  }
  if (!myVote && ["lead", "under-review"].includes(deal.status)) {
    return {
      label: "Member Action",
      title: "Your vote is needed",
      detail: deal.requested_next_step || "Vote, request more information, or schedule a call.",
      primary: "Vote Now",
      tone: "hot",
      target: "vote",
    };
  }
  if (approvalVotes >= quorumNeeded && !agreementReady) {
    return {
      label: "Deal Terms",
      title: "Finalize the deal-level agreement",
      detail: "Define offer authority, capital commitments, roles, economics, risk, and exit plan.",
      primary: "Open Agreement",
      tone: "warn",
      target: "agreement",
    };
  }
  if (blockedDiligence > 0) {
    return {
      label: "Diligence Blocker",
      title: "Clear blocked diligence",
      detail: `${blockedDiligence} diligence item${blockedDiligence === 1 ? "" : "s"} must be resolved before execution.`,
      primary: "Review Diligence",
      tone: "warn",
      target: "diligence",
    };
  }
  if (approvalVotes >= quorumNeeded && agreementReady) {
    return {
      label: "Ready For Execution",
      title: "Convert the approved deal",
      detail: "Move this deal into the project workspace so money, documents, timeline, and execution stay together.",
      primary: "Convert To Project",
      tone: "success",
      target: "project",
    };
  }
  if (deal.disposition_status && deal.disposition_status !== "not-started") {
    return {
      label: "Disposition",
      title: "Work buyer demand and offers",
      detail: deal.disposition_next_step || "Track campaigns, buyer replies, and offers from the CRM.",
      primary: "Open Disposition",
      tone: "calm",
      target: "disposition",
    };
  }
  return {
    label: "Group Review",
    title: votes.length ? "Keep collecting member direction" : "Review the member packet",
    detail: deal.requested_next_step || "Use the calculator, communication history, and diligence checklist to choose the next stage.",
    primary: votes.length ? "Review Votes" : "Review Packet",
    tone: "calm",
    target: votes.length ? "vote" : "packet",
  };
}
