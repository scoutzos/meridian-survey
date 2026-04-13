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
          priority: "critical",
        },
        {
          id: "rc-2",
          text: "Mailing address",
          priority: "critical",
        },
        {
          id: "rc-3",
          text: "Do you have an existing LLC/entity you plan to use? If yes, provide the entity name and state of formation.",
          priority: "critical",
          options: [
            "Yes — I have an existing LLC (provide details below)",
            "No — I need to create one",
            "I'm not sure yet",
          ],
        },
        {
          id: "rc-4",
          text: "Are you committed to actively participating in this partnership? (Weekly meetings, tasks, decision-making — not silent participation)",
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
