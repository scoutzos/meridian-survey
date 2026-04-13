import type { Survey } from "./surveys";

export const readinessSurvey: Survey = {
  id: "readiness-commitment",
  title: "Readiness & Commitment",
  description: "Quick check-in: who's in, what are you bringing, and can we move now? Fill this out by Wednesday.",
  categories: [
    {
      id: "rc-whos-in",
      name: "Who's In?",
      questions: [
        {
          id: "rc-1",
          text: "Full legal name (as it appears on your ID)",
          context: "We need this to file the LLC. The name on the operating agreement has to match your legal ID exactly.",
          priority: "critical",
        },
        {
          id: "rc-2",
          text: "Mailing address",
          context: "Required for LLC formation paperwork and the registered agent filing. This is where official documents get sent.",
          priority: "critical",
        },
        {
          id: "rc-3",
          text: "Do you want to join the partnership as an individual or through your own LLC?",
          context: "This matters for the operating agreement. If you join through your LLC, your entity is the legal member — not you personally. That adds a layer of liability protection but requires your LLC to be in good standing. Either way works, we just need to know so the attorney drafts it correctly.",
          priority: "critical",
          options: [
            "As an individual — put my name on the operating agreement",
            "Through my LLC — my entity will be the member",
            "I'm not sure yet — I need to talk to the attorney first",
          ],
        },
        {
          id: "rc-3b",
          text: "If joining through your LLC, provide the entity name, state of formation, and your title (e.g., Managing Member).",
          context: "The attorney needs this for the operating agreement. If you selected 'as an individual' above, just type N/A.",
          priority: "critical",
        },
        {
          id: "rc-4",
          text: "Are you committed to actively participating in this partnership? (Weekly meetings, tasks, decision-making — not silent participation)",
          context: "We need to know who's showing up and doing the work, not just whose name is on the paperwork. The LLC filing depends on knowing exactly who's in.",
          priority: "critical",
          options: [
            "Yes — I'm fully committed and ready to show up every week",
            "Yes — but I may miss occasionally due to work/life",
            "I want to be involved but can't commit to weekly meetings right now",
            "I'm still deciding",
          ],
        },
      ],
    },
    {
      id: "rc-stake",
      name: "What's Your Stake?",
      questions: [
        {
          id: "rc-5",
          text: "How much are you contributing toward startup/admin costs? (VAs, call tools, organizational expenses — estimated $300-$500 per person)",
          context: "Before we can start finding deals, we need to hire VAs and set up call tools. This is the immediate money needed to get the operation running — not the big investment, just the startup fuel.",
          priority: "critical",
          options: [
            "$300",
            "$400",
            "$500",
            "More than $500",
            "I can't contribute to admin costs right now",
          ],
        },
        {
          id: "rc-6",
          text: "How much are you contributing toward the first deal?",
          context: "This is your investment capital for the first flip or land purchase. Your contribution determines your ownership percentage on that deal, which goes into the operating agreement.",
          priority: "critical",
          options: [
            "Up to $1,000",
            "Up to $5,000",
            "Up to $10,000",
            "More than $10,000",
            "I don't have capital for the first deal right now",
          ],
        },
        {
          id: "rc-7",
          text: "Is your contribution cash, credit, or both? (If credit, how much is available?)",
          context: "Lenders look at what the group brings to the table. We need to know the full picture — cash on hand plus available credit — so we can plan financing and show lenders we're serious.",
          priority: "critical",
          options: [
            "Cash only",
            "Credit only",
            "Both cash and credit",
          ],
        },
        {
          id: "rc-8",
          text: "Is there anything else you bring to the table? (Industry knowledge, contractor connections, sweat equity, real estate license, etc.)",
          context: "Not everything is about money. The operating agreement accounts for sweat equity, skills, and connections. If you bring a GC relationship or a real estate license, that has value — say it here so it gets documented.",
          priority: "critical",
        },
      ],
    },
    {
      id: "rc-readiness",
      name: "Can We Move Now?",
      questions: [
        {
          id: "rc-9",
          text: "Do you have your contribution available today, or do you need time? (If you need time, how long?)",
          context: "We're trying to fund the bank account and start hiring VAs this week. We need to know if you're ready to move now or if you need a timeline, so we can plan around it.",
          priority: "critical",
          options: [
            "Ready now — I can transfer funds this week",
            "I need 1-2 weeks",
            "I need about a month",
            "I need more than a month",
          ],
        },
        {
          id: "rc-10",
          text: "Are you comfortable with a lender pulling your credit as part of the financing process?",
          context: "Most hard money and conventional lenders require a credit pull for anyone who owns 25% or more of the LLC. If you have concerns about your credit, we need to know now so we can plan the financing structure accordingly.",
          priority: "critical",
          options: [
            "Yes — no concerns",
            "Yes — but I'd like to know when it's happening beforehand",
            "I have concerns about my credit and want to discuss first",
            "No — I'm not comfortable with that right now",
          ],
        },
      ],
    },
  ],
};
