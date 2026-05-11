export type StatusDomain =
  | "lead"
  | "seller-disposition"
  | "sms"
  | "deal"
  | "calculator"
  | "vote"
  | "agreement"
  | "diligence"
  | "disposition"
  | "project"
  | "generic";

export type StatusDefinition = {
  value: string;
  label: string;
  domain: StatusDomain;
  stage?: "open" | "working" | "blocked" | "approved" | "closed";
};

export const STATUS_DEFINITIONS: StatusDefinition[] = [
  { domain: "lead", value: "new", label: "New", stage: "open" },
  { domain: "lead", value: "contacted", label: "Contacted", stage: "working" },
  { domain: "lead", value: "replied", label: "Replied", stage: "working" },
  { domain: "lead", value: "interested", label: "Interested", stage: "working" },
  { domain: "lead", value: "follow-up", label: "Follow Up", stage: "working" },
  { domain: "lead", value: "bad-number", label: "Bad Number", stage: "blocked" },
  { domain: "lead", value: "dnc", label: "DNC", stage: "blocked" },
  { domain: "lead", value: "passed", label: "Passed", stage: "closed" },
  { domain: "lead", value: "converted", label: "Converted", stage: "approved" },

  { domain: "seller-disposition", value: "no-answer", label: "No Answer", stage: "working" },
  { domain: "seller-disposition", value: "left-voicemail", label: "Left Voicemail", stage: "working" },
  { domain: "seller-disposition", value: "wrong-number", label: "Wrong Number", stage: "blocked" },
  { domain: "seller-disposition", value: "not-interested", label: "Not Interested", stage: "closed" },
  { domain: "seller-disposition", value: "wants-too-much", label: "Wants Too Much", stage: "working" },
  { domain: "seller-disposition", value: "interested", label: "Interested", stage: "working" },
  { domain: "seller-disposition", value: "send-offer", label: "Send Offer", stage: "approved" },

  { domain: "sms", value: "unknown", label: "Unknown", stage: "open" },
  { domain: "sms", value: "opted-in", label: "Opted In", stage: "approved" },
  { domain: "sms", value: "opted-out", label: "Opted Out", stage: "blocked" },
  { domain: "sms", value: "failed", label: "Failed", stage: "blocked" },
  { domain: "sms", value: "delivered", label: "Delivered", stage: "working" },
  { domain: "sms", value: "replied", label: "Replied", stage: "working" },

  { domain: "deal", value: "draft", label: "Draft", stage: "open" },
  { domain: "deal", value: "lead", label: "Draft Lead", stage: "open" },
  { domain: "deal", value: "under-review", label: "Submitted For Review", stage: "working" },
  { domain: "deal", value: "needs-more-info", label: "Needs More Info", stage: "blocked" },
  { domain: "deal", value: "voting", label: "Voting", stage: "working" },
  { domain: "deal", value: "approved-to-offer", label: "Approved To Offer", stage: "approved" },
  { domain: "deal", value: "offer-made", label: "Offer Made", stage: "working" },
  { domain: "deal", value: "under-contract", label: "Under Contract", stage: "approved" },
  { domain: "deal", value: "due-diligence", label: "Due Diligence", stage: "working" },
  { domain: "deal", value: "passed", label: "Passed", stage: "closed" },
  { domain: "deal", value: "converted-to-project", label: "Converted To Project", stage: "approved" },

  { domain: "calculator", value: "not-started", label: "Not Started", stage: "open" },
  { domain: "calculator", value: "needs-inputs", label: "Needs Inputs", stage: "blocked" },
  { domain: "calculator", value: "needs-review", label: "Needs Review", stage: "working" },
  { domain: "calculator", value: "strong-review", label: "Strong Review", stage: "approved" },
  { domain: "calculator", value: "review-with-caution", label: "Review With Caution", stage: "working" },
  { domain: "calculator", value: "likely-pass", label: "Likely Pass", stage: "closed" },

  { domain: "vote", value: "not-requested", label: "Not Requested", stage: "open" },
  { domain: "vote", value: "waiting-on-votes", label: "Waiting On Votes", stage: "working" },
  { domain: "vote", value: "quorum-reached", label: "Quorum Reached", stage: "working" },
  { domain: "vote", value: "approved", label: "Approved", stage: "approved" },
  { domain: "vote", value: "split-decision", label: "Split Decision", stage: "blocked" },
  { domain: "vote", value: "rejected", label: "Rejected", stage: "closed" },
  { domain: "vote", value: "more-info-requested", label: "More Info Requested", stage: "blocked" },
  { domain: "vote", value: "make-offer", label: "Make Offer", stage: "approved" },
  { domain: "vote", value: "counter", label: "Counter", stage: "approved" },
  { domain: "vote", value: "needs-more-info", label: "Needs Info", stage: "blocked" },
  { domain: "vote", value: "schedule-call", label: "Schedule Call", stage: "working" },
  { domain: "vote", value: "urgent-review", label: "Urgent Review", stage: "working" },
  { domain: "vote", value: "pass", label: "Pass", stage: "closed" },

  { domain: "agreement", value: "not-started", label: "Not Started", stage: "open" },
  { domain: "agreement", value: "draft", label: "Draft", stage: "open" },
  { domain: "agreement", value: "ready-for-review", label: "Ready For Review", stage: "working" },
  { domain: "agreement", value: "approved", label: "Approved", stage: "approved" },
  { domain: "agreement", value: "signed", label: "Signed", stage: "approved" },
  { domain: "agreement", value: "superseded", label: "Superseded", stage: "closed" },

  { domain: "diligence", value: "open", label: "Open", stage: "open" },
  { domain: "diligence", value: "in-review", label: "In Review", stage: "working" },
  { domain: "diligence", value: "cleared", label: "Cleared", stage: "approved" },
  { domain: "diligence", value: "blocked", label: "Blocked", stage: "blocked" },
  { domain: "diligence", value: "not-applicable", label: "N/A", stage: "closed" },

  { domain: "disposition", value: "not-started", label: "Not Started", stage: "open" },
  { domain: "disposition", value: "exit-strategy-set", label: "Exit Strategy Set", stage: "working" },
  { domain: "disposition", value: "buyer-list-built", label: "Buyer List Built", stage: "working" },
  { domain: "disposition", value: "marketed", label: "Marketed", stage: "working" },
  { domain: "disposition", value: "buyer-interest", label: "Buyer Interest", stage: "working" },
  { domain: "disposition", value: "offer-received", label: "Offer Received", stage: "working" },
  { domain: "disposition", value: "buyer-under-contract", label: "Buyer Under Contract", stage: "approved" },
  { domain: "disposition", value: "closing-scheduled", label: "Closing Scheduled", stage: "approved" },
  { domain: "disposition", value: "closed", label: "Closed", stage: "closed" },
  { domain: "disposition", value: "fell-through", label: "Fell Through", stage: "blocked" },

  { domain: "project", value: "created", label: "Created", stage: "open" },
  { domain: "project", value: "active", label: "Active", stage: "working" },
  { domain: "project", value: "at-risk", label: "At Risk", stage: "blocked" },
  { domain: "project", value: "blocked", label: "Blocked", stage: "blocked" },
  { domain: "project", value: "closing", label: "Closing", stage: "approved" },
  { domain: "project", value: "complete", label: "Complete", stage: "closed" },
  { domain: "project", value: "archived", label: "Archived", stage: "closed" },
];

const STATUS_BY_VALUE = new Map(STATUS_DEFINITIONS.map(status => [status.value, status]));

export function labelForStatus(value: string | null | undefined): string {
  if (!value) return "Not Set";
  const normalized = value.trim().toLowerCase();
  const defined = STATUS_BY_VALUE.get(normalized);
  if (defined) return defined.label;
  return normalized.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function statusStage(value: string | null | undefined): StatusDefinition["stage"] {
  if (!value) return "open";
  return STATUS_BY_VALUE.get(value.trim().toLowerCase())?.stage ?? "open";
}

export function statusesForDomain(domain: StatusDomain): StatusDefinition[] {
  return STATUS_DEFINITIONS.filter(status => status.domain === domain);
}
