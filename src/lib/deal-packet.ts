import type { DealAnalysis, DealInput } from "./deals";

export type PacketSource =
  | "Property record"
  | "Contact record"
  | "Calculator"
  | "Research"
  | "VA note"
  | "Manual override"
  | "System";

export interface PacketReadinessItem {
  label: string;
  detail: string;
  source: PacketSource;
  done: boolean;
}

export interface PacketRiskMitigation {
  risk: string;
  why: string;
  mitigation: string;
  source: PacketSource;
  status: "Open" | "Review" | "Blocked";
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function packetLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\n|;/)
    .map(line => line.trim())
    .filter(Boolean);
}

export function uniquePacketItems(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function buildPacketReadiness({
  input,
  analysis,
  evidenceCount,
  sellerTouchCount,
  propertyLinked,
  contactLinked,
  riskCount,
}: {
  input: DealInput;
  analysis: DealAnalysis;
  evidenceCount: number;
  sellerTouchCount: number;
  propertyLinked: boolean;
  contactLinked: boolean;
  riskCount: number;
}): PacketReadinessItem[] {
  const hasProperty = propertyLinked || !!(input.address?.trim() || input.parcel_id?.trim());
  const hasContact = contactLinked || !!(input.seller_name?.trim() || input.seller_phone?.trim());
  const hasOfferModel = hasNumber(input.asking_price) || hasNumber(analysis.acquisition.maxOffer) || hasNumber(analysis.acquisition.recommendedOffer);
  const risksReviewed = riskCount === 0 || !!input.submit_uncertainties?.trim();

  return [
    {
      label: "Property linked",
      detail: hasProperty ? "Address/APN is available for members." : "Connect or enter the property record.",
      source: "Property record",
      done: hasProperty,
    },
    {
      label: "Contact linked",
      detail: hasContact ? "Seller/contact identity is available." : "Connect or enter the seller/contact.",
      source: "Contact record",
      done: hasContact,
    },
    {
      label: "Calls/texts present",
      detail: sellerTouchCount ? `${sellerTouchCount} touch${sellerTouchCount === 1 ? "" : "es"} logged.` : "Log at least one call, text, or contact note.",
      source: "Contact record",
      done: sellerTouchCount > 0,
    },
    {
      label: "Price model present",
      detail: hasOfferModel ? "Ask or offer model is available." : "Add asking price, max offer, or recommended offer.",
      source: "Calculator",
      done: hasOfferModel,
    },
    {
      label: "Exit strategy selected",
      detail: input.exit_strategy?.trim() ? "Exit path is documented." : "Add the target exit strategy.",
      source: "VA note",
      done: !!input.exit_strategy?.trim(),
    },
    {
      label: "Risks reviewed",
      detail: risksReviewed ? "Risk notes are ready for member review." : "Explain open risks or confirm no major blockers.",
      source: "VA note",
      done: risksReviewed,
    },
    {
      label: "Evidence attached",
      detail: evidenceCount ? `${evidenceCount} source${evidenceCount === 1 ? "" : "s"} attached.` : "Attach links, comps, maps, county records, or photos.",
      source: "Research",
      done: evidenceCount > 0,
    },
    {
      label: "Member ask written",
      detail: input.requested_next_step?.trim() ? "Decision needed is clear." : "Write the exact decision or next step.",
      source: "VA note",
      done: !!(input.review_intent && input.requested_next_step?.trim()),
    },
    {
      label: "VA summary written",
      detail: input.submission_summary?.trim() ? "Executive summary is ready." : "Add the short member-facing summary.",
      source: "VA note",
      done: !!input.submission_summary?.trim(),
    },
  ];
}

function riskMeta(risk: string): Omit<PacketRiskMitigation, "risk"> {
  const lower = risk.toLowerCase();
  if (lower.includes("missing:")) {
    return {
      why: "Members cannot make a clean decision without this field.",
      mitigation: "Fill the missing item or state why it can wait until the next step.",
      source: "System",
      status: "Open",
    };
  }
  if (lower.includes("phone") || lower.includes("contact") || lower.includes("seller")) {
    return {
      why: "Seller intent and authority are unclear without verified contact context.",
      mitigation: "Confirm the best phone/contact, log the latest touch, and note motivation or timing.",
      source: "Contact record",
      status: "Review",
    };
  }
  if (lower.includes("dnc") || lower.includes("litigator")) {
    return {
      why: "Compliance issues can block outbound outreach.",
      mitigation: "Do not text until compliance is cleared; use allowed call/manual review path only.",
      source: "Contact record",
      status: "Blocked",
    };
  }
  if (lower.includes("flood")) {
    return {
      why: "Flood exposure can affect buildability, buyer pool, and resale value.",
      mitigation: "Attach FEMA/county map evidence and adjust the offer or exit strategy if exposure is material.",
      source: "Research",
      status: "Review",
    };
  }
  if (lower.includes("wetland")) {
    return {
      why: "Wetlands can limit usable acreage and require additional approvals.",
      mitigation: "Attach wetlands mapper evidence and confirm usable acreage before members vote.",
      source: "Research",
      status: "Review",
    };
  }
  if (lower.includes("landlocked") || lower.includes("access") || lower.includes("frontage")) {
    return {
      why: "Legal/physical access can make the property hard to finance, sell, or build on.",
      mitigation: "Verify road frontage, deeded easement, or neighbor access before approving offer authority.",
      source: "Property record",
      status: "Blocked",
    };
  }
  if (lower.includes("zoning") || lower.includes("build")) {
    return {
      why: "Zoning and buildability determine the real buyer pool and exit path.",
      mitigation: "Confirm zoning/future land use with county records and document minimum lot standards.",
      source: "Research",
      status: "Review",
    };
  }
  if (lower.includes("utility")) {
    return {
      why: "Utility uncertainty can change development cost and resale demand.",
      mitigation: "Confirm water, sewer, power, or septic path and note cost impact.",
      source: "Research",
      status: "Review",
    };
  }
  if (lower.includes("buyer demand") || lower.includes("target buyer")) {
    return {
      why: "The exit plan needs buyer evidence, not just a theoretical resale value.",
      mitigation: "Attach buyer replies, comp support, nearby builder activity, or neighbor interest.",
      source: "Research",
      status: "Open",
    };
  }
  if (lower.includes("asking") || lower.includes("mao") || lower.includes("offer") || lower.includes("price")) {
    return {
      why: "Pricing drives whether the opportunity has enough spread for Meridian.",
      mitigation: "Show max offer, spread at ask, and counter strategy before member vote.",
      source: "Calculator",
      status: "Review",
    };
  }
  if (lower.includes("tax")) {
    return {
      why: "Tax status can affect closing, title work, and seller proceeds.",
      mitigation: "Pull county tax status and include payoff or delinquency notes in the packet.",
      source: "Research",
      status: "Review",
    };
  }
  return {
    why: "This item may affect member confidence or next-step approval.",
    mitigation: "Assign an owner, add supporting evidence, or document why it is acceptable.",
    source: "VA note",
    status: "Review",
  };
}

export function buildPacketRiskMitigations({
  input,
  analysis,
  extraFlags = [],
}: {
  input: DealInput;
  analysis: DealAnalysis;
  extraFlags?: string[];
}): PacketRiskMitigation[] {
  const risks = uniquePacketItems([
    ...extraFlags,
    ...analysis.riskFlags,
    ...analysis.missingInfo.map(item => `Missing: ${item}`),
    ...packetLines(input.submit_uncertainties),
  ]);

  return risks.map(risk => ({
    risk,
    ...riskMeta(risk),
  }));
}
