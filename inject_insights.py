#!/usr/bin/env python3
"""Inject AI insight boxes into each question slide of the presentation."""

import re

# Map slide number -> (consensus_emoji, consensus_label, recommendation, why_matters, watch_out, suggested_language)
insights = {
    1: {
        "qid": "0-0",
        "consensus": "🟡 Moderate Consensus",
        "consensus_class": "partial",
        "explanation": "Most want to build experience then branch off, but there's divergence on long-term vision (full-service firm vs. individual pursuits).",
        "recommendation": "Define explicit 3-year milestones with annual check-ins. Set Year 1 goal (complete first deal), Year 2 goal (2-3 deals + evaluate), Year 3 (reassess collective vs. individual paths).",
        "why": "Misaligned vision is the #1 killer of partnerships. If some members want a 20-year empire and others want a 3-year learning vehicle, resentment builds fast.",
        "watchout": "Without milestones, you'll drift for 18 months before realizing you're not on the same page. By then, money and relationships are at stake.",
        "language": "\"The LLC shall conduct annual strategic reviews. Members shall establish 12-month operational milestones at each review, with a comprehensive 3-year reassessment of the LLC's mission and structure.\""
    },
    2: {
        "qid": "0-1",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "All 6 members agree on learning together. Good secondary alignment on income generation and leveraging the collective.",
        "recommendation": "Acknowledge multiple goals are valid but prioritize deal completion as the shared metric. Learning happens BY doing deals, not instead of doing deals.",
        "why": "When multiple goals compete, groups get paralyzed. Having one shared success metric keeps everyone rowing in the same direction.",
        "watchout": "Don't let 'learning' become an excuse for inaction. Set a deadline for the first deal (e.g., 6 months from OA signing).",
        "language": "\"The primary objective of the LLC is to acquire, develop, and dispose of real estate for profit, with an emphasis on member education and skill development through active deal participation.\""
    },
    3: {
        "qid": "0-2",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 favor moderate risk. Peggee leans conservative. Raquel selected both conservative and moderate.",
        "recommendation": "Default to moderate-conservative approach. Any deal requiring aggressive risk tolerance needs unanimous approval. This respects Peggee's comfort level without paralyzing the group.",
        "why": "If one member is losing sleep over the risk level, it poisons the group dynamic. Better to go slightly slower with everyone comfortable than fast with someone anxious.",
        "watchout": "Define what 'moderate risk' actually means in dollar terms. Abstract risk tolerance means nothing — put numbers on it (max leverage, max loss per deal, etc.).",
        "language": "\"Deals shall be evaluated on a moderate-conservative risk basis. Any deal with projected risk exceeding [defined threshold] or requiring non-standard financing shall require unanimous Member approval.\""
    },
    4: {
        "qid": "0-3",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "Most say 5-10 hours with some variability. Courtney and Raquel can commit 10-20 hours.",
        "recommendation": "Set minimum 5 hrs/week with task tracking. Members consistently under-contributing should trigger accountability provisions. Use a shared project management tool.",
        "why": "Unequal effort is the #2 killer of partnerships (after misaligned vision). Without tracking, resentment builds silently.",
        "watchout": "\"It varies\" is a red flag for accountability. Require weekly check-ins or task updates so everyone can see who's contributing what.",
        "language": "\"Each Member commits to a minimum of five (5) hours per week of LLC business activity. Members shall log activities in the designated project management system. Consistent failure to meet minimum commitments for 60+ days triggers the accountability provisions in Section [X].\""
    },
    5: {
        "qid": "0-4",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "Trust and lack of progress are universal concerns — 6/6 on lack of progress, 5/6 on trust. These are the group's core values.",
        "recommendation": "Build in quarterly progress reviews and annual trust/satisfaction surveys. Create an anonymous feedback mechanism. Address issues early before they fester.",
        "why": "The group is self-aware about what kills partnerships. Now build the systems to prevent exactly these two things.",
        "watchout": "Don't wait until trust is broken to address it. Quarterly anonymous pulse surveys (even just 3 questions) catch problems early.",
        "language": "\"The LLC shall conduct quarterly progress reviews measuring deal pipeline, financial performance, and member satisfaction. An annual anonymous trust survey shall be administered. Results below [threshold] trigger a mandatory group discussion within 14 days.\""
    },
    7: {
        "qid": "1-0",
        "consensus": "🔴 Major Disagreement",
        "consensus_class": "disagreement",
        "explanation": "This is the most split question in the survey. Options range from equal ownership to deal-by-deal to weighted by capital. No clear majority.",
        "recommendation": "Hybrid approach — equal base ownership for the LLC entity (voting, governance), but deal-by-deal profit splits based on contribution to each specific deal. This is the most common structure for investment groups and satisfies both camps.",
        "why": "Ownership structure affects EVERYTHING — voting power, profit splits, exit valuations, tax treatment. Getting this wrong is unfixable without major restructuring.",
        "watchout": "Equal ownership sounds fair but creates resentment when contributions are unequal. Pure contribution-based sounds logical but creates complex accounting. The hybrid approach handles both.",
        "language": "\"Members shall hold equal Membership Interests for governance purposes. Profit and loss allocation for each Project shall be determined by a Project Allocation Agreement specifying each Member's capital, labor, and resource contributions to that specific Project.\""
    },
    8: {
        "qid": "1-1",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor supermajority, 3/6 favor unanimous. Both camps agree: new members need significant approval.",
        "recommendation": "Unanimous consent for new members. This protects everyone. Standard practice for small LLCs. You chose your partners for a reason — everyone should have veto power on new ones.",
        "why": "A bad member can destroy an LLC. Every existing member should have the right to say no. This is your business family — unanimous consent is the norm.",
        "watchout": "Don't let the desire to grow override the need for compatibility. One wrong member can cost you more than they contribute.",
        "language": "\"Admission of new Members requires unanimous written consent of all existing Members. Prospective members must complete the same onboarding survey and meet with all existing Members before a vote is taken.\""
    },
    9: {
        "qid": "1-2",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 want unanimous consent for transfers. Strong preference for restricting outside sales.",
        "recommendation": "No outside transfers — must offer to group first (right of first refusal). Unanimous consent required for any exception. This prevents unwanted partners from showing up.",
        "why": "Without transfer restrictions, a member could sell their interest to a stranger. You'd be in business with someone you never chose. This is standard LLC protection.",
        "watchout": "Make sure the buyback terms are fair — if the group can block transfers AND lowball the buyout price, departing members are trapped.",
        "language": "\"No Member may Transfer any Membership Interest without first offering such Interest to the remaining Members under the Right of First Refusal provisions. Any Transfer to a non-Member requires unanimous written consent.\""
    },
    10: {
        "qid": "1-3",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "4/6 favor mandatory buyout at FMV, 3/6 favor heir gets economic interest only. Responses are varied across the four scenarios.",
        "recommendation": "Heir gets economic interest only (distributions), no voting rights. Group has 90-day buyout option at FMV. This is the industry standard protective provision — it protects BOTH the family (they get economic value) and the LLC (no unwanted decision-makers).",
        "why": "Without this provision, a deceased member's 18-year-old heir could be voting on your business decisions. Or a divorcing spouse's attorney could demand LLC records.",
        "watchout": "Have your attorney draft separate provisions for each scenario (death, incapacity, divorce, bankruptcy). One-size-fits-all language misses important nuances.",
        "language": "\"Upon death, the deceased Member's Interest converts to an Economic Interest only. The LLC shall have 90 days to exercise a buyout option at Fair Market Value. Similar provisions apply for incapacity (with POA holder acting for 6 months), divorce, and bankruptcy.\""
    },
    12: {
        "qid": "2-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "Split between $5K fixed (3/6) and variable amounts (4/6). Different financial capacities in the group.",
        "recommendation": "$5,000 minimum within 30 days, with option for members to contribute more for proportional preferred return on extra capital. This accommodates different financial positions while ensuring everyone has skin in the game.",
        "why": "Without a minimum, some members may contribute nothing upfront, creating an imbalance from day one. The minimum ensures commitment; the optional extra rewards those who can do more.",
        "watchout": "If $5K is a stretch for any member, that's important information. The group should know everyone can comfortably commit the minimum without financial stress.",
        "language": "\"Each Member shall contribute a minimum Initial Capital Contribution of $5,000 within 30 days of executing this Agreement. Additional voluntary contributions shall receive a preferred return of [8-10]% before pro-rata profit distribution.\""
    },
    13: {
        "qid": "2-1",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 agree on accepting cash, property, services, and credit/lending capacity. Broad flexibility with Odessa preferring cash-only.",
        "recommendation": "Cash, property, services, and credit — but ALL non-cash contributions must be valued in writing and approved by majority vote. This prevents disputes over sweat equity value.",
        "why": "Sweat equity disputes are the #3 killer of partnerships. If someone contributes 100 hours of 'marketing' and values it at $10K, you need a system to validate that.",
        "watchout": "Credit/lending capacity is valuable but hard to value. Define how guaranteeing a loan translates to ownership/profit credit BEFORE the first deal.",
        "language": "\"Contributions may be in cash, property, services, or credit capacity. All non-cash contributions shall be valued in a written Contribution Valuation Agreement approved by majority vote prior to acceptance.\""
    },
    14: {
        "qid": "2-2",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 favor 30-day grace period with ownership reduction. 4/6 also like the loan treatment approach.",
        "recommendation": "30-day grace period, then treated as a loan from other members at 8% annual interest. If not cured in 60 days, ownership reduces proportionally. This combines the two most popular answers.",
        "why": "Life happens — someone might have a temporary cash flow issue. The grace period is compassionate; the consequences are fair. The interest rate compensates members who cover the gap.",
        "watchout": "Put the specific percentages and timelines in writing. 'Grace period' without specifics leads to arguments about what's 'reasonable.'",
        "language": "\"Late contributions receive a 30-day grace period. After 30 days, the shortfall is treated as a loan from contributing Members at 8% annual interest. If not cured within 60 days, the delinquent Member's Interest is reduced proportionally.\""
    },
    15: {
        "qid": "2-3",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 favor optional capital calls with preferred return for contributors. Clean consensus.",
        "recommendation": "Capital calls optional. Contributing members get preferred return (8-10%) on additional capital before pro-rata split. This is fair and encourages participation without forcing it.",
        "why": "Mandatory capital calls can bankrupt a member or force them out. Optional calls with preferred return reward those who step up without punishing those who can't.",
        "watchout": "Define what 'preferred return' means precisely — is it cumulative? Does it compound? When does it get paid? Your CPA needs clear language.",
        "language": "\"Capital calls are voluntary. Members who contribute additional capital shall receive a cumulative preferred return of [8-10]% on such capital, paid before any pro-rata profit distribution on the applicable Project.\""
    },
    17: {
        "qid": "3-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "4/6 favor two co-managing members, 3/6 like rotation. Courtney wants all members to manage. No clear single winner.",
        "recommendation": "Two Co-Managing Members for Year 1, then reassess. Rotating annually is impractical for banking/contracts. Co-managers provide accountability without concentrating power.",
        "why": "Having a single point of authority is essential for banks, contractors, and vendors. But with a new group, two people provide checks and balances.",
        "watchout": "All-member management sounds democratic but creates chaos — who signs the check? Who calls the contractor? Decision-making needs clear authority lines.",
        "language": "\"Two Members shall serve as Co-Managing Members for the initial 12-month term. Co-Managing Members shall divide responsibilities as agreed in writing. The role shall be reassessed annually by majority vote.\""
    },
    18: {
        "qid": "3-1",
        "consensus": "✅ Strong Consensus (but needs nuance)",
        "consensus_class": "strong",
        "explanation": "6/6 want all expenditures approved. Unanimous — but this may not be practical in reality.",
        "recommendation": "Managing Members can approve up to $2,500 independently for BUDGETED items. Above that requires majority. All unbudgeted expenses need group approval. $0 threshold is impractical — you'll have constant micro-votes that slow everything down.",
        "why": "When you're mid-renovation and need $500 in materials TODAY, you can't wait for 6 people to vote. A reasonable threshold keeps projects moving.",
        "watchout": "The group's instinct for total control is understandable for a new LLC. But if every $50 purchase needs a vote, nothing gets done. Trust your managing members for small stuff.",
        "language": "\"Co-Managing Members may independently approve budgeted expenditures up to $2,500 per transaction. Expenditures between $2,500 and $10,000 require majority approval. All expenditures over $10,000 and all unbudgeted expenses require majority approval regardless of amount.\""
    },
    19: {
        "qid": "3-2",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "Split between one-vote-per-member with mediator (3/6) and one-vote-per-member for ops with weighted for financial (3/6). Everyone agrees on one-vote-per-member for operations.",
        "recommendation": "One vote per member for operational decisions. For financial decisions over $25K, weight by ownership/capital contribution. Neutral third-party mediator for ties. Balances equality with financial skin-in-the-game.",
        "why": "Equal voting feels fair for day-to-day decisions. But when big money is on the line, members with more capital at risk should have proportional influence.",
        "watchout": "Define exactly which decisions are 'operational' vs 'financial.' Without clear categories, every vote becomes a debate about HOW to vote.",
        "language": "\"Operational decisions: one vote per Member. Financial decisions exceeding $25,000: weighted by Capital Account balance. Ties on operational matters resolved by neutral mediator within 14 days.\""
    },
    20: {
        "qid": "3-3",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "No single approach commands majority. 3/6 favor the tiered system, 2/6 want unanimous for all major decisions, 2/6 want supermajority for everything.",
        "recommendation": "Majority for day-to-day ops. Supermajority (2/3) for: taking on debt over $25K, removing a member, major expenses. Unanimous for: new members, dissolution, amending OA, selling LLC assets. This is the standard 3-tier structure used by most successful LLCs.",
        "why": "Too much unanimity = paralysis. Too much majority rule = minority members feel powerless. The 3-tier system balances speed with protection.",
        "watchout": "List EVERY specific decision type and its required vote threshold. Don't leave any gray area — that's where disputes happen.",
        "language": "\"Majority vote: day-to-day operations, vendor selection, project timelines. Supermajority (2/3): debt over $25K, removing a Member, unbudgeted expenses over $10K. Unanimous: new Members, dissolution, OA amendments, sale of LLC assets.\""
    },
    21: {
        "qid": "3-4",
        "consensus": "🔴 Needs Discussion",
        "consensus_class": "disagreement",
        "explanation": "5 different answers from 6 members. No alignment at all. Courtney wants all-member sign-off, Odessa and Peggee want Managing Member + one, Raquel wants Managing Member only, Tiffany wants any two.",
        "recommendation": "Managing Member(s) for budgeted items up to $2,500. Two signatures required above $2,500. All signatures for contracts over $25K. Balances speed with control.",
        "why": "Banks and vendors need clear signature authority. If everyone has to sign everything, you'll miss deadlines. If only one person can sign, there's no oversight.",
        "watchout": "Set this up with your bank from day one. Adding signers later is a hassle. Also ensure the OA matches what the bank has on file.",
        "language": "\"Co-Managing Members have individual signature authority for budgeted items up to $2,500. Transactions $2,500-$25,000 require two Member signatures. Contracts and transactions over $25,000 require signatures of all Members.\""
    },
    23: {
        "qid": "4-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor deal-by-deal waterfall. Good alignment on this approach.",
        "recommendation": "Deal-by-deal waterfall — return capital first, then preferred return to capital contributors, then remaining profit split based on contribution to that specific deal. Most fair for an investment group where contributions vary by deal.",
        "why": "This is the industry standard for real estate investment groups. It rewards the people who put in the most on each specific deal.",
        "watchout": "Define the waterfall steps precisely: (1) return of capital, (2) preferred return %, (3) remaining split formula. Vague waterfalls cause expensive disputes.",
        "language": "\"Profits from each Project shall be distributed in the following order: (1) Return of contributed capital to each participating Member, (2) Preferred return of [8-10]% to capital contributors, (3) Remaining profits allocated per the Project Allocation Agreement.\""
    },
    24: {
        "qid": "4-1",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 say after each deal closes. Courtney prefers majority vote, Raquel prefers quarterly.",
        "recommendation": "After each deal closes, with a 10% reserve held for LLC operating expenses. Quarterly reconciliation of the reserve. This gives members timely returns while keeping the LLC funded.",
        "why": "Members need to see returns to stay motivated. Holding profits indefinitely kills morale. But you need operating reserves for the next deal.",
        "watchout": "Don't distribute 100% of profits — you'll have no operating capital for the next deal. The 10% reserve prevents constant capital calls.",
        "language": "\"Distributions shall be made within 30 days of each Project closing. The LLC shall retain 10% of net profits as an operating reserve. The reserve shall be reconciled quarterly; excess reserves above [amount] distributed pro-rata.\""
    },
    25: {
        "qid": "4-2",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor pro-rata by ownership. Courtney and Raquel prefer equal allocation. Some also want deal-specific allocation.",
        "recommendation": "Pro-rata by ownership percentage. This is the tax-compliant default and what your CPA will need for K-1s. Equal allocation only works if ownership is perfectly equal.",
        "why": "The IRS requires loss allocations to have 'substantial economic effect.' Pro-rata by ownership is the safe harbor. Creative allocations need expensive tax planning.",
        "watchout": "If you do deal-by-deal profit splits but equal loss allocation, you'll have a tax mess. Losses should follow the same structure as profits.",
        "language": "\"Losses shall be allocated pro-rata based on each Member's Membership Interest percentage, consistent with IRC Section 704(b) substantial economic effect requirements.\""
    },
    27: {
        "qid": "5-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 say cannot exit during active deals. 3/6 also want no minimum at all. The group values deal protection.",
        "recommendation": "1-year minimum commitment AND cannot exit while active deals are in progress. Both provisions protect the group. The minimum prevents hit-and-run members; the deal restriction prevents mid-project abandonment.",
        "why": "If a member exits mid-renovation, the remaining members absorb their responsibilities AND their risk. This can sink a deal.",
        "watchout": "Define 'active deal' precisely — does it include properties under contract? Properties listed for sale? Only properties under construction?",
        "language": "\"Members commit to a minimum 12-month term. No voluntary withdrawal permitted while any Project is active (defined as: under contract, under construction, or listed for sale). Withdrawing Members must provide 90 days written notice after all conditions are met.\""
    },
    28: {
        "qid": "5-1",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 favor negotiation. 2/6 also like formula-based. The group prefers flexibility.",
        "recommendation": "Formula-based as the default — capital account balance plus pro-rata share of unrealized gains (based on third-party appraisal if disputed). Negotiation as backup. Having a formula prevents stalemates.",
        "why": "Pure negotiation sounds flexible but creates power imbalances. The departing member is in a weak position. A formula provides a fair starting point.",
        "watchout": "Without a default formula, buyout negotiations can drag on for months while the departing member's capital is trapped. Have the formula as a backstop.",
        "language": "\"Departing Member's Interest shall be valued at: Capital Account balance plus pro-rata share of unrealized gains on LLC assets. If parties cannot agree on asset values within 30 days, an independent appraiser selected by mutual agreement shall determine FMV.\""
    },
    29: {
        "qid": "5-2",
        "consensus": "🔴 Needs Discussion",
        "consensus_class": "disagreement",
        "explanation": "Spread across all options: 30-day (2), 60-day (2), 90-day (1), no ROFR (2). No clear winner.",
        "recommendation": "60-day right of first refusal. 30 days is too short to arrange capital; 90 days is too long for the departing member. 60 is the standard in most LLC operating agreements.",
        "why": "Without ROFR, a member could sell to anyone. With it, the group controls who joins. The timeline just needs to be practical for both sides.",
        "watchout": "ROFR without a fair pricing mechanism is toothless. The group needs to match the offered price, not dictate a lower one.",
        "language": "\"Remaining Members shall have a 60-day Right of First Refusal to purchase a departing Member's Interest at the same price and terms offered by any bona fide third-party purchaser.\""
    },
    30: {
        "qid": "5-3",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 favor negotiated case-by-case. Only Aaliyah prefers lump sum within 90 days.",
        "recommendation": "Default to 50% within 90 days, remainder over 12 months at prime + 2%. Case-by-case negotiation allowed but having a default prevents stalemates when emotions run high.",
        "why": "During an exit, relationships are strained. Having a default structure removes one contentious negotiation point. Either party can propose alternatives.",
        "watchout": "If the LLC doesn't have cash to buy out a member, you'll need a payment plan. Without a default, the departing member may demand full cash and force a fire sale.",
        "language": "\"Default buyout terms: 50% of the purchase price within 90 days, remaining balance in equal monthly installments over 12 months at Prime Rate + 2%. Alternative terms may be negotiated by mutual agreement.\""
    },
    31: {
        "qid": "5-4",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 agree on fraud/embezzlement/criminal conviction. 4/6 also include consistent failure after written notice. Clean alignment.",
        "recommendation": "Fraud/embezzlement, felony conviction, consistent failure after 2 written notices, personal bankruptcy affecting LLC. Supermajority vote required for removal. This covers the bases without being overly punitive.",
        "why": "Without removal provisions, a bad actor can hold the LLC hostage. With overly broad provisions, removal becomes a weapon in personal disputes.",
        "watchout": "Require 2 WRITTEN notices before removal for performance issues. Verbal warnings don't count and can't be proven. Paper trail protects everyone.",
        "language": "\"Grounds for involuntary removal: (a) fraud or embezzlement, (b) felony conviction, (c) failure to meet obligations after 2 written notices, (d) personal bankruptcy materially affecting LLC operations. Removal requires supermajority (2/3) vote.\""
    },
    32: {
        "qid": "5-5",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "Three-way split: heir inherits economic interest (3/6), mandatory buyout (3/6), and automatic inheritance (3/6). Members selected multiple options.",
        "recommendation": "Heir inherits economic interest only (no voting). Group has 90-day option to buy out at FMV. Life insurance policy recommended (not required) to fund buyout. This protects both family and LLC.",
        "why": "The deceased member's family deserves fair value. The LLC deserves to choose its own members. Economic-interest-only solves both problems.",
        "watchout": "If the LLC can't fund the buyout, the heir is stuck with a non-voting interest that may never pay distributions. Consider requiring life insurance on key members.",
        "language": "\"Upon death, the deceased Member's Interest converts to an Economic Interest. Heir receives distributions but has no voting or management rights. The LLC has a 90-day option to purchase the Economic Interest at FMV. Members are encouraged to maintain life insurance sufficient to fund a buyout.\""
    },
    33: {
        "qid": "5-6",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor 6-month grace period then mandatory buyout. 3/6 also want POA holder to act. Good layered approach.",
        "recommendation": "POA holder acts for 6 months. If no recovery, group has mandatory buyout right at FMV. Member should designate a successor representative in the OA.",
        "why": "Incapacity is the most emotionally difficult scenario. The 6-month window is compassionate. The mandatory buyout after that protects the LLC from indefinite limbo.",
        "watchout": "Without a designated POA/successor, the LLC may need court involvement to deal with the incapacitated member's interest. Require each member to designate someone at OA signing.",
        "language": "\"Upon incapacity, the Member's designated Power of Attorney or Successor Representative shall act on their behalf for up to 6 months. If no recovery within 6 months, the LLC shall have a mandatory buyout right at FMV, payable under the standard buyout terms.\""
    },
    34: {
        "qid": "5-7",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "4/6 favor case-by-case, but 3/6 also want OA to explicitly exclude spouse claims. Mixed approach.",
        "recommendation": "OA explicitly excludes spouse claims to membership. Spouse can only receive financial value through court-ordered buyout. Spousal consent/acknowledgment signed at formation is the strongest protection.",
        "why": "In Georgia, marital property laws can give a spouse a claim to LLC interests. An explicit exclusion in the OA, combined with spousal acknowledgment, is your best defense.",
        "watchout": "Case-by-case sounds flexible but leaves the LLC vulnerable. A divorcing spouse's attorney will exploit any ambiguity. Lock this down in advance.",
        "language": "\"No spouse or domestic partner of any Member shall have any claim to Membership rights. In the event of divorce, the non-Member spouse may only receive the financial value of the Member's Interest, not membership or voting rights. Spousal acknowledgment required at execution of this Agreement.\""
    },
    36: {
        "qid": "6-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "6/6 agree on leverage. 5/6 specifically want hard money for flips, conventional for holds. Perfect alignment.",
        "recommendation": "Exactly as the group wants. Set maximum LTV limits (e.g., 80% for holds, 90% for flips with hard money). Having written limits prevents someone pushing for 100% financing on a risky deal.",
        "why": "The group is aligned on strategy, which is great. Now quantify it with specific limits so there's no debate when a specific deal comes up.",
        "watchout": "Hard money is expensive (12-15% interest + points). Make sure your deal projections account for carrying costs. A flip that takes 2 months longer than planned can eat all the profit.",
        "language": "\"The LLC is authorized to obtain financing for Projects. Maximum LTV: 80% for buy-and-hold, 90% for fix-and-flip with hard money. All loan terms require majority approval before commitment.\""
    },
    37: {
        "qid": "6-1",
        "consensus": "🔴 Major Split",
        "consensus_class": "disagreement",
        "explanation": "4/6 will guarantee equally, but Tiffany and Peggee refuse personal guarantees entirely. This is a fundamental disagreement.",
        "recommendation": "This needs an honest conversation. Most hard money lenders require personal guarantees. Option: only members who guarantee a specific deal get an additional profit share (guarantee premium of 2-5%). This compensates risk-takers without forcing anyone.",
        "why": "Personal guarantees mean your personal assets are at risk. Some members can't or won't accept that risk. Forcing them out isn't the answer; compensating willing guarantors is.",
        "watchout": "If NO ONE will guarantee, your financing options shrink dramatically. Non-recourse lending exists but at higher rates and lower LTVs. Budget accordingly.",
        "language": "\"Personal guarantees are voluntary. Members who personally guarantee a Project loan shall receive a Guarantee Premium of [2-5]% of the guaranteed amount, paid from Project profits before pro-rata distribution. Non-guaranteeing Members accept lower profit share on that Project.\""
    },
    39: {
        "qid": "7-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor single signature for budgeted items with group approval for unbudgeted. Courtney and Raquel want all-member signatures for everything.",
        "recommendation": "Single signature for budgeted items under $2,500. Two signatures for $2,500-$10,000. All members approve above $10,000. Balances efficiency with oversight.",
        "why": "Too many signatures = missed payments and delayed projects. Too few = risk of unauthorized spending. The tiered approach is industry standard.",
        "watchout": "Set up your bank account with these exact thresholds from day one. Most banks can configure dual-signature requirements above a set amount.",
        "language": "\"Banking controls: Single authorized signature for budgeted items under $2,500. Dual signature required for $2,500-$10,000. All-Member approval required for transactions exceeding $10,000 and all unbudgeted expenditures.\""
    },
    41: {
        "qid": "8-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 agree — yes with full disclosure. Raquel says yes with no disclosure needed. Universal agreement that outside deals are allowed.",
        "recommendation": "Full disclosure required within 7 days. LLC has 14-day right of first offer on any deal in metro Atlanta. No restrictions on deals outside the target market. This balances freedom with group opportunity.",
        "why": "Prohibiting outside deals is unenforceable and breeds resentment. Disclosure with right of first offer gives the LLC a chance without restricting members.",
        "watchout": "Define 'target market' geographically. If someone finds a deal in Macon, does the LLC get first dibs? Clarity prevents disputes.",
        "language": "\"Members may pursue outside real estate activities with full written disclosure within 7 days. The LLC has a 14-day Right of First Offer on any opportunity within [defined market area]. Opportunities outside the target market require disclosure but no right of first offer.\""
    },
    42: {
        "qid": "8-1",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "Split between unanimous approval at/below market rate (3/6) and competitive bids (3/6). Everyone agrees it should be allowed with safeguards.",
        "recommendation": "Allowed with competitive bids and majority approval. Member-vendor must recuse from the approval vote. Standard conflict-of-interest provision used by most LLCs.",
        "why": "Members will have useful skills (contracting, property management, etc.). Banning member-vendors wastes resources. Competitive bids ensure fair pricing.",
        "watchout": "The recusal is key — if the member-vendor votes on their own contract, it's a conflict of interest that could invalidate the agreement.",
        "language": "\"Members may provide services to the LLC at competitive market rates. The Member-vendor must obtain at least two comparable bids and recuse from the approval vote. Majority approval of non-conflicted Members required.\""
    },
    44: {
        "qid": "9-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "4/6 favor commission to LLC, but 4/6 also want deal-by-deal decisions. 3/6 favor a 50/50 split. Multiple views.",
        "recommendation": "Commission goes to LLC as revenue UNLESS the licensed member is doing the deal on personal time outside of LLC business. For LLC deals, the commission benefits everyone.",
        "why": "Licensed members bring significant value. But if the LLC is the client, the commission should benefit the entity. Personal deals are different.",
        "watchout": "The licensed member still pays their brokerage split and bears licensing costs. Consider reimbursing license/MLS/insurance fees from LLC funds as a compromise.",
        "language": "\"Commissions earned by licensed Members on LLC transactions shall be LLC revenue. The LLC shall reimburse the licensed Member's proportional licensing, MLS, and E&O insurance costs. Commissions on non-LLC personal transactions belong to the individual Member.\""
    },
    46: {
        "qid": "10-0",
        "consensus": "🔴 Needs Discussion",
        "consensus_class": "disagreement",
        "explanation": "Four different answers, no clear majority. 2 want unanimous + pro-rata, 2 want unanimous + complete projects first, 2 want supermajority, 1 wants 3/4 supermajority.",
        "recommendation": "Unanimous to dissolve. Complete active projects first, then pay debts, return capital contributions, split remainder pro-rata. This protects members who are mid-deal.",
        "why": "Dissolution mid-project can mean selling assets at fire-sale prices. Completing active projects maximizes value for everyone. Unanimous requirement prevents minority-forced dissolution.",
        "watchout": "What if the group is deadlocked AND unanimous dissolution is required? That's why you need the deadlock provisions (question 17-0) to work hand-in-hand with this.",
        "language": "\"Dissolution requires unanimous vote. Upon dissolution: (1) complete all active Projects, (2) pay all debts and obligations, (3) return Capital Contributions to Members, (4) distribute remaining assets pro-rata by Membership Interest.\""
    },
    48: {
        "qid": "11-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor mandatory mediation then binding arbitration. Strong alignment on keeping disputes out of court.",
        "recommendation": "Mandatory mediation (30 days), then binding arbitration if unresolved. No litigation — it's expensive and public. Arbitration is faster, private, and cheaper. Georgia courts enforce arbitration clauses.",
        "why": "A single lawsuit can cost $50K-$200K and take 2-3 years. Mediation costs $2-5K and takes a week. Arbitration costs $5-15K and takes 2-3 months. The math is clear.",
        "watchout": "Specify the arbitration provider (AAA, JAMS) and location (Atlanta) in the OA. Without specifics, you'll argue about WHERE to arbitrate before you even start.",
        "language": "\"All disputes shall first be submitted to mediation within 30 days. If unresolved, binding arbitration under AAA Commercial Rules in Atlanta, Georgia. Members waive the right to jury trial and litigation. The arbitrator's decision is final and enforceable.\""
    },
    50: {
        "qid": "12-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "3/6 favor semi-annual then annual. 3/6 favor event-triggered only. 1/6 wants annual. No clear majority.",
        "recommendation": "Semi-annually for first 2 years (you'll learn a LOT in year 1), then annually. Supermajority (2/3) to amend standard provisions, unanimous for core provisions (ownership, dissolution, new members).",
        "why": "Your first OA will be wrong about SOMETHING. Regular reviews let you fix issues before they become crises. After year 2, you'll know your operating rhythm.",
        "watchout": "Don't make amendments too easy (majority could override minority on important issues) or too hard (unanimous for everything means nothing ever changes).",
        "language": "\"The Operating Agreement shall be reviewed semi-annually for the first 24 months, then annually. Amendments to standard provisions require supermajority (2/3) vote. Amendments to core provisions (ownership, dissolution, admission, capital) require unanimous vote.\""
    },
    52: {
        "qid": "13-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 say no restrictions after exit. Only Odessa wants non-solicitation. The group values individual freedom.",
        "recommendation": "No non-compete (unenforceable in many situations anyway). Non-solicitation for 12 months — can't recruit members or take LLC vendor/lender relationships. Protects the group without restricting individual careers.",
        "why": "Non-competes in real estate are nearly unenforceable in Georgia. Non-solicitation is enforceable and protects what matters most: your team and your business relationships.",
        "watchout": "Without non-solicitation, a departing member could hire your contractor, use your lender, and recruit your best member. That's the real risk — not 'competition.'",
        "language": "\"No non-compete restriction upon exit. Departing Members agree to a 12-month non-solicitation period: no recruiting active Members or soliciting LLC vendor, lender, or client relationships.\""
    },
    54: {
        "qid": "14-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "3/6 favor annual tax distribution before K-1s. 2/6 want quarterly distributions. 2/6 want highest marginal rate. Raquel says no — members handle their own taxes.",
        "recommendation": "Mandatory annual tax distribution before K-1s at the highest member's marginal rate. This is standard LLC practice. Without it, members owe taxes on phantom income they never received.",
        "why": "K-1 income is taxable whether or not you receive cash. If the LLC earns $100K but distributes nothing, each member still owes taxes on their share. Tax distributions prevent this nightmare.",
        "watchout": "Raquel should understand this protects HER. Without tax distributions, she'd owe thousands in taxes on income she never received. This is non-negotiable for most CPAs.",
        "language": "\"The LLC shall make mandatory annual tax distributions sufficient to cover each Member's estimated tax liability on LLC income, calculated at the highest marginal rate among Members. Tax distributions shall be made before K-1s are issued.\""
    },
    56: {
        "qid": "15-0",
        "consensus": "🔴 Needs Discussion",
        "consensus_class": "disagreement",
        "explanation": "2/6 say required, 2/6 say recommended, 1/6 says no, 1/6 is unsure. Spread across all options.",
        "recommendation": "REQUIRED before signing OA. This is cheap insurance. A spousal acknowledgment prevents a divorcing spouse from claiming they didn't know about the LLC. Georgia courts have split on this — the acknowledgment removes ambiguity.",
        "why": "If a member's spouse claims 'I never knew about this business,' a Georgia court might grant them membership rights in the divorce. A signed acknowledgment eliminates that argument.",
        "watchout": "This isn't about trust — it's about legal protection. Even happily married members should get spousal acknowledgment. It costs nothing and prevents a potential catastrophe.",
        "language": "\"Prior to execution of this Agreement, each Member shall obtain a signed Spousal Acknowledgment from their spouse or domestic partner, acknowledging the existence of the LLC and waiving any claim to Membership rights.\""
    },
    58: {
        "qid": "16-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "Universal agreement — LLC owns everything. 4/6 say departing members have no claim. 3/6 add departing members can't use the brand at all.",
        "recommendation": "LLC owns all IP. Departing members have zero claim. On dissolution, IP is sold or transferred by majority vote. Standard and clean.",
        "why": "If a member leaves and takes the brand, the remaining members lose the reputation they all built. IP ownership by the entity is Business 101.",
        "watchout": "Register the trademark now. An unregistered name has weaker legal protection. $250-$350 to file with the USPTO.",
        "language": "\"All intellectual property, including the Meridian Collective name, logo, website, and social media accounts, is owned by the LLC. Departing Members have no claim to IP. Upon dissolution, IP shall be sold or transferred by majority vote.\""
    },
    60: {
        "qid": "17-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor mediation, 4/6 favor bringing in an advisor. Good overlap showing the group wants structured external help for deadlocks.",
        "recommendation": "30-day cooling period → mandatory mediation → if still deadlocked after 60 days, bring in a mutually agreed advisor. Forced dissolution only as absolute last resort after 120 days.",
        "why": "Deadlocks happen. Having a clear escalation path prevents panic. Most deadlocks resolve with time and a neutral perspective.",
        "watchout": "Pre-select your mediator/advisor NOW, when everyone is on good terms. Trying to agree on a mediator when you're already fighting is nearly impossible.",
        "language": "\"Deadlock resolution: (1) 30-day cooling period, (2) mandatory mediation, (3) if unresolved after 60 days, mutually agreed advisor makes binding recommendation, (4) if no resolution after 120 days, any Member may trigger dissolution proceedings.\""
    },
    62: {
        "qid": "18-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "3/6 favor duty of care only (allowing outside deals). 3/6 want the attorney to define standards. 2/6 want modified loyalty. Overlapping preferences.",
        "recommendation": "Duty of care required. Duty of loyalty MODIFIED to allow outside real estate activity with full disclosure. This matches the group's answer on outside deals. Let the attorney draft Georgia-specific language.",
        "why": "Full duty of loyalty would prohibit outside real estate deals — which contradicts Question 8-0 where everyone agreed to allow them. Modified loyalty reconciles these two positions.",
        "watchout": "This is one area where you MUST have an attorney draft the language. Fiduciary duty provisions have specific legal meanings in Georgia that can't be approximated.",
        "language": "\"Members owe a duty of care to the LLC. The duty of loyalty is modified to permit outside real estate activity in compliance with the Outside Activity provisions of this Agreement. Attorney shall draft Georgia-compliant fiduciary duty language.\""
    },
    64: {
        "qid": "19-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "Everyone agrees on comprehensive coverage. 4/6 want broker-recommended full package. 3/6 specifically list GL + property + umbrella + builder's risk.",
        "recommendation": "GL + property + umbrella ($1M minimum) + builder's risk on active projects. Get an insurance broker who specializes in real estate development. Budget $3-5K/year.",
        "why": "One lawsuit from an injured worker on your job site can exceed $1M. Without proper insurance, members are personally liable. This is non-negotiable.",
        "watchout": "Builder's risk is separate from GL and often forgotten. It covers damage to the property during construction. Without it, a fire during renovation could wipe out your entire investment.",
        "language": "\"The LLC shall maintain: General Liability ($1M), Property Insurance on each asset, Umbrella Policy ($1M minimum), and Builder's Risk on active construction Projects. An insurance broker specializing in real estate development shall be retained.\""
    },
    66: {
        "qid": "20-0",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "3/6 favor shared accounting software with member access. 3/6 prefer professional bookkeeper. 2/6 want CPA firm. Multiple approaches.",
        "recommendation": "Professional bookkeeper + shared accounting software (QuickBooks or similar) with real-time access for all members. Monthly reconciliation. Annual CPA review. Transparency prevents disputes.",
        "why": "DIY bookkeeping leads to errors and suspicion. Professional bookkeeper + member access gives you accuracy AND transparency — the two things that prevent financial disputes.",
        "watchout": "Budget $200-400/month for a bookkeeper. It's one of the best investments you'll make. Financial disputes have destroyed more LLCs than bad deals.",
        "language": "\"The LLC shall retain a professional bookkeeper. Financial records shall be maintained in shared accounting software accessible to all Members in real-time. Monthly reconciliation required. Annual review by a licensed CPA.\""
    },
    68: {
        "qid": "21-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 favor indemnification excluding gross negligence. Split from there — 2/6 want full indemnification, 2/6 want none at all.",
        "recommendation": "Indemnification for all members acting in good faith within their authority, EXCLUDING gross negligence and intentional misconduct. This is the standard protective provision.",
        "why": "Without indemnification, no one will want to be Managing Member. If signing a routine contract could expose you to personal liability, no rational person takes that role.",
        "watchout": "Tiffany's 'no indemnification' position would make the LLC unmanageable. Who would sign a lease knowing they're personally liable if anything goes wrong?",
        "language": "\"The LLC shall indemnify and hold harmless each Member for actions taken in good faith within the scope of their authority, except for gross negligence, willful misconduct, or actions outside their authorized scope.\""
    },
    70: {
        "qid": "22-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "4/6 prefer direct but private. 3/6 also are direct/head-on. Mix of styles but everyone leans toward direct communication.",
        "recommendation": "Acknowledge different styles. Establish rule: address issues within 7 days, privately first, then bring to group if unresolved. No passive aggression. Schedule quarterly check-ins specifically for interpersonal issues.",
        "why": "Knowing each other's conflict styles prevents misunderstandings. Tiffany and Aaliyah need processing time — that's not avoidance, it's their style. Respect it.",
        "watchout": "The 7-day rule is key. Without a deadline, 'I need time to process' can become 'I'm going to ignore this forever.' Grace period + deadline works for all styles.",
        "language": "\"Members agree to address interpersonal and operational conflicts within 7 days, privately with the involved parties first. If unresolved within 14 days, the issue shall be raised at the next group meeting. Quarterly interpersonal check-ins are mandatory.\""
    },
    71: {
        "qid": "22-1",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 want to be held accountable. 3/6 also want accountability to go both ways. 2/6 prefer private accountability. Everyone values it.",
        "recommendation": "Monthly task review. If a member misses commitments 2 months in a row, formal written notice. This is a strength of the group — everyone values accountability.",
        "why": "The group's universal desire for accountability is rare and valuable. Channel it into a simple, consistent system so it doesn't become ad hoc criticism.",
        "watchout": "Accountability without structure becomes nagging. Use a shared task board with clear owners and deadlines. The system holds people accountable, not individual members pointing fingers.",
        "language": "\"Monthly accountability reviews of task completion and commitments. Two consecutive months of unmet commitments triggers a formal written notice. Accountability applies equally to all Members regardless of role.\""
    },
    73: {
        "qid": "23-0",
        "consensus": "✅ Strong Consensus",
        "consensus_class": "strong",
        "explanation": "5/6 will share relevant LLC information. Raquel and others also express desire for privacy on personal details. Good balance.",
        "recommendation": "Members share financial info directly relevant to LLC decisions (credit score for loan applications, available capital for deals). No requirement to share full personal financial picture. Privacy with purpose.",
        "why": "When applying for an LLC loan, the lender will ask for everyone's financials anyway. Better to share proactively within the group than be surprised at the lender's office.",
        "watchout": "If a member's financial situation changes dramatically (bankruptcy, lawsuit, etc.), it can affect the LLC. Require disclosure of material changes that could impact LLC operations.",
        "language": "\"Members shall disclose financial information directly relevant to LLC operations upon request, including credit score, available capital, and material financial changes. Full personal financial disclosure is not required.\""
    },
    74: {
        "qid": "23-1",
        "consensus": "🟡 Partial Consensus",
        "consensus_class": "partial",
        "explanation": "Range from $5K (Peggee) to $50K (Aaliyah). Most cluster around $5K-$10K. Wide range.",
        "recommendation": "Plan deals based on the LOWEST comfort level ($5K from Peggee). Don't structure deals that require more than the minimum any member can commit. Scale up as trust and profits grow.",
        "why": "If you structure a deal requiring $10K from each member and Peggee can only do $5K, you have a problem on day one. Start conservative and grow.",
        "watchout": "The $5K-$50K range suggests very different financial situations. This is fine — but structure deals so no one is stretched beyond their comfort zone.",
        "language": "\"Initial deal structuring shall accommodate a maximum individual risk exposure of $5,000 per Member. As the LLC generates returns and builds reserves, risk thresholds may be increased by majority vote.\""
    },
    76: {
        "qid": "24-0/24-1/24-2",
        "consensus": "📝 Open-Ended Responses",
        "consensus_class": "partial",
        "explanation": "Key themes: timelines & goals (Courtney), continued education requirements (Odessa), contractor hiring & conflicts of interest (Peggee), member vetting criteria (Peggee), spousal involvement (Peggee).",
        "recommendation": "Action items from open responses: (1) Set specific timelines and milestones for first deal, (2) Decide if continued education membership is required, (3) Add contractor/vendor conflict-of-interest provisions, (4) Document member vetting criteria for future members, (5) Address spousal involvement boundaries.",
        "why": "These open-ended responses reveal concerns that didn't fit neatly into multiple choice. Peggee's questions about vetting and conflicts of interest suggest she's thinking carefully about governance.",
        "watchout": "Odessa's question about Delphine's classes and Peggee's questions about vetting suggest there may be unspoken concerns about readiness and commitment levels. Address these directly.",
        "language": "\"Consider adding provisions for: (1) mandatory continuing education, (2) vendor/contractor conflict-of-interest disclosure, (3) member vetting criteria and process, (4) defined timelines for first deal execution.\""
    },
    77: {
        "qid": "24-1",
        "consensus": "📝 Open-Ended Responses",
        "consensus_class": "partial",
        "explanation": "Courtney wants timelines and goals. Odessa wants to know if everyone is ready. Peggee is concerned about spousal involvement and operating capital.",
        "recommendation": "These concerns point to a need for a formal kickoff meeting where: (1) Everyone verbally commits and shares their readiness level, (2) Timelines are set for OA finalization and first deal, (3) Operating capital vs. investment capital is clearly distinguished.",
        "why": "Unanswered questions create anxiety and hesitation. Addressing them head-on builds the trust everyone identified as critical.",
        "watchout": "If members have questions they haven't voiced, there may be deeper concerns. Create safe space for honest conversation before signing anything.",
        "language": "\"The LLC shall hold a formal Formation Meeting within 14 days of OA execution to establish: operational timelines, first-deal criteria, roles and responsibilities, and address all outstanding member concerns.\""
    },
    78: {
        "qid": "24-2",
        "consensus": "📝 Open-Ended Responses",
        "consensus_class": "partial",
        "explanation": "Odessa is ready to go. Raquel wants to start making money and memories. Peggee asks about member vetting. Energy is high but some want more clarity.",
        "recommendation": "The energy is there! Channel it into action: schedule the attorney meeting, set a first-deal target date, and create the shared workspace. Momentum is your friend right now.",
        "why": "Groups that spend too long planning never start. You've done the hard work of surveying — now move to execution. Peggee's vetting question should be answered as part of the OA.",
        "watchout": "Don't lose this momentum to analysis paralysis. Set a 30-day deadline to have the OA drafted and a 60-day deadline for first deal sourcing.",
        "language": "\"Action: Retain attorney within 14 days. OA draft within 30 days. First deal identification within 60 days. Use survey results as attorney brief for OA drafting.\""
    },
}

# Read the existing HTML
with open('/Users/courtneymosely/clawd-ike/meridian-survey/public/presentation.html', 'r') as f:
    html = f.read()

# CSS for AI insight box
insight_css = """
/* AI Insight Box */
.ai-insight-box {
  margin-top: 0.8rem;
  background: rgba(108, 99, 255, 0.06);
  border: 1px solid;
  border-image: linear-gradient(135deg, rgba(108,99,255,0.4), rgba(78,205,196,0.4)) 1;
  border-radius: 0;
  padding: 1rem 1.2rem;
  position: relative;
  flex-shrink: 0;
}
.ai-insight-box.collapsed .ai-insight-content { display: none; }
.ai-insight-header {
  display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
  user-select: none; font-size: 0.9rem; font-weight: 600;
  color: #b8b0ff;
}
.ai-insight-header .toggle-icon { transition: transform 0.2s; font-size: 0.7rem; }
.ai-insight-box.collapsed .toggle-icon { transform: rotate(-90deg); }
.ai-insight-content { margin-top: 0.8rem; }
.ai-insight-row { margin-bottom: 0.6rem; }
.ai-insight-label {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; margin-bottom: 0.15rem;
}
.ai-insight-label.consensus-strong { color: #2ecc71; }
.ai-insight-label.consensus-partial { color: #f1c40f; }
.ai-insight-label.consensus-disagreement { color: #e74c3c; }
.ai-insight-label.consensus-open { color: #b8b0ff; }
.ai-insight-label.recommend { color: #4ECDC4; }
.ai-insight-label.why { color: #8B83FF; }
.ai-insight-label.watchout { color: #FF6B6B; }
.ai-insight-label.language { color: #95E1D3; }
.ai-insight-value {
  font-size: 0.78rem; color: #bbb; line-height: 1.45;
}
.ai-insight-value code {
  background: rgba(255,255,255,0.05); padding: 0.2rem 0.4rem;
  border-radius: 3px; font-size: 0.75rem; color: #ccc;
  display: block; margin-top: 0.2rem; white-space: pre-wrap;
}
"""

# Inject CSS before </style>
html = html.replace('</style>', insight_css + '</style>')

def make_insight_html(data):
    consensus_class_map = {
        "strong": "consensus-strong",
        "partial": "consensus-partial", 
        "disagreement": "consensus-disagreement",
    }
    cc = consensus_class_map.get(data["consensus_class"], "consensus-open")
    
    return f'''
    <div class="ai-insight-box" onclick="this.classList.toggle('collapsed')">
      <div class="ai-insight-header">
        <span class="toggle-icon">▼</span>
        <span>🤖 AI Insight</span>
        <span style="font-weight:400;color:#888;font-size:0.75rem;margin-left:auto">(click to collapse)</span>
      </div>
      <div class="ai-insight-content">
        <div class="ai-insight-row">
          <div class="ai-insight-label {cc}">Consensus: {data["consensus"]}</div>
          <div class="ai-insight-value">{data["explanation"]}</div>
        </div>
        <div class="ai-insight-row">
          <div class="ai-insight-label recommend">✅ Recommended Resolution</div>
          <div class="ai-insight-value">{data["recommendation"]}</div>
        </div>
        <div class="ai-insight-row">
          <div class="ai-insight-label why">💡 Why It Matters</div>
          <div class="ai-insight-value">{data["why"]}</div>
        </div>
        <div class="ai-insight-row">
          <div class="ai-insight-label watchout">⚠️ Watch Out</div>
          <div class="ai-insight-value">{data["watchout"]}</div>
        </div>
        <div class="ai-insight-row">
          <div class="ai-insight-label language">📝 Suggested OA Language Direction</div>
          <div class="ai-insight-value"><code>{data["language"]}</code></div>
        </div>
      </div>
    </div>'''

# For each slide with insights, inject the insight box before the closing </div></div></div>
# The pattern is: find slide-N's content, insert before the last two closing divs
for slide_num, data in insights.items():
    slide_id = f'id="slide-{slide_num}"'
    
    insight_html = make_insight_html(data)
    
    # Find the slide and inject before its closing tags
    # Pattern: find the slide, then find the last </div>\n  </div>\n</div> within it
    # We need to find the answer-grid or open-ended-grid closing div and insert after it
    
    # Strategy: find the slide start, then find the next slide start (or end), 
    # and insert the insight before the </div></div></div> pattern
    
    start_marker = f'<div class="slide" id="slide-{slide_num}">'
    if slide_num == 0:
        start_marker = f'<div class="slide active" id="slide-{slide_num}">'
    
    start_idx = html.find(start_marker)
    if start_idx == -1:
        print(f"Warning: Could not find slide-{slide_num}")
        continue
    
    # Find the end of this slide's content (the closing </div> tags before next slide)
    # Look for the pattern "    </div>\n  </div>\n</div>" which ends each slide
    # Or more reliably, find the next <div class="slide" after this one
    next_slide_idx = html.find('<div class="slide"', start_idx + 10)
    if next_slide_idx == -1:
        next_slide_idx = html.find('<script>', start_idx)
    
    # Within this slide, find the last occurrence of </div> sequence
    slide_html = html[start_idx:next_slide_idx]
    
    # Insert before the last 3 </div> (slide-content close, slide close... actually 2)
    # The structure is: <div class="slide"><div class="slide-content">...[answer-grid]...</div></div>
    # We want to insert after the answer-grid div closes, before slide-content closes
    
    # Find last "</div>\n</div>" in the slide
    # Actually, let's find "    </div>\n  </div>\n</div>" 
    
    # Better: insert before the 2nd-to-last </div> in the slide section
    # The structure ends with: </div>\n  </div>\n</div>\n
    # = close answer-grid, close slide-content, close slide
    
    # Find the position of the closing </div> for slide-content
    # That's the second </div> from the end of the slide html
    
    # Count backwards for </div> occurrences  
    last_div = slide_html.rfind('</div>')
    second_last_div = slide_html.rfind('</div>', 0, last_div)
    
    # Insert the insight HTML before the second-to-last </div>
    insert_pos = start_idx + second_last_div
    html = html[:insert_pos] + insight_html + '\n    ' + html[insert_pos:]

# Update slide count in JS and counter - count all slides
slide_count = html.count('<div class="slide')
print(f"Total slides: {slide_count}")

# Write the result
with open('/Users/courtneymosely/clawd-ike/meridian-survey/public/presentation.html', 'w') as f:
    f.write(html)

print("Done! Insights injected.")
