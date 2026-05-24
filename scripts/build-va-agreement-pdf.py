from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "contracts" / "meridian-va-independent-contractor-agreement-no-trial-period.pdf"
LOGO = ROOT / "public" / "logo.jpeg"

BRASS = colors.HexColor("#B08954")
BRASS_LIGHT = colors.HexColor("#C9A878")
DEEP = colors.HexColor("#0C0F0D")
BONE = colors.HexColor("#F4EFE6")
PAPER = colors.HexColor("#FFFDF8")
INK = colors.HexColor("#171B18")
MUTED = colors.HexColor("#5E655F")
LINE = colors.HexColor("#DED5C6")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "BrandKicker",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        textColor=BRASS_LIGHT,
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "TitleSerif",
        parent=styles["Title"],
        alignment=TA_CENTER,
        textColor=BONE,
        fontName="Times-Roman",
        fontSize=25,
        leading=28,
        spaceAfter=9,
    )
)
styles.add(
    ParagraphStyle(
        "HeroCopy",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        textColor=colors.HexColor("#D8CFBD"),
        fontName="Helvetica",
        fontSize=9,
        leading=13,
    )
)
styles.add(
    ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        textColor=DEEP,
        fontName="Helvetica-Bold",
        fontSize=9.7,
        leading=12,
        spaceBefore=8,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        textColor=INK,
        fontName="Helvetica",
        fontSize=8.85,
        leading=12.2,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        "Small",
        parent=styles["BodyText"],
        textColor=MUTED,
        fontName="Helvetica",
        fontSize=7.4,
        leading=10,
    )
)
styles.add(
    ParagraphStyle(
        "Label",
        parent=styles["BodyText"],
        textColor=BRASS,
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
    )
)


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def section(title, *paragraphs):
    flow = [p(title.upper(), "Section")]
    flow.extend(p(item) if isinstance(item, str) else item for item in paragraphs)
    return flow


def bullet_list(items):
    return ListFlowable(
        [ListItem(p(item), bulletColor=BRASS) for item in items],
        bulletType="bullet",
        leftIndent=14,
        bulletFontName="Helvetica",
        bulletFontSize=6,
        spaceAfter=4,
    )


def field(label, value="____________________________________"):
    return [p(label.upper(), "Label"), p(value, "Body")]


def signature_box(title, entity):
    data = [
        [p(title.upper(), "Label")],
        [p(f"<b>{entity}</b>")],
        [Spacer(1, 0.2 * inch)],
        [p("________________________________________", "Body")],
        [p("SIGNATURE", "Small")],
        [Spacer(1, 0.12 * inch)],
        [p("________________________________________", "Body")],
        [p("NAME / TITLE" if title == "Company" else "NAME", "Small")],
        [Spacer(1, 0.12 * inch)],
        [p("________________________________________", "Body")],
        [p("DATE", "Small")],
    ]
    table = Table(data, colWidths=[3.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFAF1")),
                ("BOX", (0, 0), (-1, -1), 0.75, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return table


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.rect(0.38 * inch, 0.38 * inch, letter[0] - 0.76 * inch, letter[1] - 0.76 * inch, fill=0, stroke=1)
    canvas.setStrokeColor(BRASS)
    canvas.setLineWidth(2.2)
    canvas.line(0.62 * inch, 0.49 * inch, letter[0] - 0.62 * inch, 0.49 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(letter[0] / 2, 0.25 * inch, "Meridian Collective Group · Disciplined investing. Honest partnership. Lasting value.")
    canvas.restoreState()


def cover_header():
    logo = Image(str(LOGO), width=1.25 * inch, height=1.24 * inch)
    hero = Table(
        [
            [logo],
            [p("INDEPENDENT CONTRACTOR AGREEMENT", "BrandKicker")],
            [p("Virtual Assistant Agreement", "TitleSerif")],
            [
                p(
                    "Prepared for a virtual assistant engagement supporting Meridian Collective Group operations, administrative workflows, lead management, and related business functions.",
                    "HeroCopy",
                )
            ],
        ],
        colWidths=[6.65 * inch],
    )
    hero.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), DEEP),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (0, 0), 20),
                ("BOTTOMPADDING", (0, 3), (0, 3), 22),
                ("LINEBELOW", (0, 3), (0, 3), 4, BRASS),
            ]
        )
    )
    return hero


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=0.58 * inch,
        leftMargin=0.58 * inch,
        topMargin=0.52 * inch,
        bottomMargin=0.62 * inch,
        title="Meridian Collective Group - Virtual Assistant Independent Contractor Agreement",
        author="Meridian Collective Group",
    )

    story = [cover_header(), Spacer(1, 0.22 * inch)]

    meta = Table(
        [
            [field("Effective Date", "May 11, 2026"), field("Company", "Meridian Collective Group")],
            [field("Company Representative"), field("Contractor Name", "Sophia Marie Barilea")],
            [field("Contractor Email", "smgbarilea@gmail.com"), field("Phone / WhatsApp", "+63 945 461 9209")],
        ],
        colWidths=[3.15 * inch, 3.15 * inch],
        rowHeights=[0.45 * inch, 0.45 * inch, 0.45 * inch],
    )
    meta.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.extend([meta, Spacer(1, 0.12 * inch)])

    note = Table([[p("This agreement is a business template and should be reviewed by qualified counsel before use, especially for restrictive covenants, worker classification, wage rules, and international contractor issues.", "Small")]], colWidths=[6.3 * inch])
    note.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8F3EA")), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LINEBEFORE", (0, 0), (0, 0), 3, BRASS)]))
    story.extend([note, Spacer(1, 0.08 * inch)])

    story.extend(section("1. Engagement & Role", "Company engages Contractor as an independent contractor virtual assistant to provide administrative, operational, marketing, CRM, lead management, scheduling, inbox support, data entry, social media support, and other virtual assistant services assigned by Company.", "Contractor is not an employee, partner, agent, or legal representative of Company and has no authority to bind Company unless expressly authorized in writing."))
    story.extend(section("2. Compensation & Pay Increase", "Contractor will be paid <b>$4.50 USD per hour</b> for the first ninety (90) days of the engagement.", "Contractor's hourly rate will increase to <b>$7.00 USD per hour</b> upon the earlier of: (a) completion of the first ninety (90) days of satisfactory work; or (b) Company's closing of its first transaction/deal after Contractor's start date.", "Payment will be made weekly based on approved, accurately tracked hours and completed work. Contractor must submit time records and task summaries in the format requested by Company. Overtime or additional hours require prior written approval."))
    story.extend(section("3. Advance Repayment", "Company has advanced Contractor one (1) week of pay in the amount of $135. This advance is not a bonus and must be repaid through payroll offsets as described in this section.", "After the first two weekly pay cycles, Company will begin recovering the $135 advance over the next four (4) weekly pay cycles. During those four repayment weeks, if Contractor works 30 approved hours in a week, Company will pay Contractor for 22.5 hours and apply the remaining 7.5 hours of pay ($33.75 at the $4.50 hourly rate) toward repayment of the advance.", "If Contractor works fewer than 30 approved hours in a repayment week, Company may apply a proportional deduction or continue deductions in later pay cycles until the $135 advance is fully repaid. Upon termination, resignation, or completion of the engagement, any remaining unpaid advance balance may be deducted from final amounts owed to Contractor."))
    story.extend(section("4. Work Schedule & Availability", "Contractor may work up to 6 hours per day / 30 hours per week unless additional hours are approved in writing. Contractor may work from their own location and time zone, provided assigned deadlines are met. Contractor must provide daily status updates and must notify Company promptly of any delays, internet issues, power outages, illness, or other availability concerns."))
    story.extend(section("5. Scope of Work", bullet_list(["CRM updates, lead entry, and lead management support", "Calendar coordination, email support, and message handling", "Social media scheduling, engagement, and administrative marketing support", "Property, lead, vendor, and market research", "Document organization, data entry, reporting, and task tracking", "Client follow-up tasks approved by Company", "Other virtual assistant tasks assigned by Company"])))
    story.extend(section("6. No Outsourcing or Delegation", "Contractor must personally perform all assigned work. Contractor may not subcontract, outsource, delegate, share, transfer, or assign any Company work, account access, credentials, client information, lead information, documents, communications, or responsibilities to any other person or entity without Company's prior written consent.", "Any unauthorized outsourcing, delegation, shared login use, or third-party access is a material breach of this agreement and may result in immediate termination, loss of access, withholding of unapproved time, and any other remedies available to Company."))
    story.extend(section("7. Performance Expectations", "Contractor agrees to perform all work accurately, professionally, timely, and with attention to detail. Incomplete, inaccurate, late, careless, or unauthorized work may be returned for correction and may result in reduced hours, withheld approval of time, removal from assignments, or termination."))

    story.append(PageBreak())
    story.extend(section("8. Tools, Accounts & Security", "Company may provide Contractor access to Company systems, CRMs, email accounts, social media accounts, documents, passwords, client information, vendor information, and other business tools.", bullet_list(["Contractor must use Company accounts only for authorized business purposes.", "Contractor must keep all login credentials confidential and may not share access with anyone.", "Contractor must use reasonable security practices, including two-factor authentication when available.", "Contractor must immediately report suspected unauthorized access, lost devices, data exposure, or security incidents.", "Contractor must return, delete, or surrender Company information upon request or termination."])))
    story.extend(section("9. Monitoring & Recorded Communications", "Contractor acknowledges and agrees that Company may monitor, review, audit, screen record, capture activity logs, and retain records of Contractor's use of Company-owned or Company-provided systems, accounts, platforms, devices, files, messages, emails, CRM activity, task activity, and work product for business, quality assurance, security, training, compliance, and performance purposes.", "Contractor further consents to Company recording, transcribing, reviewing, and retaining business calls, video meetings, voicemail messages, training sessions, client calls, vendor calls, and internal calls involving Contractor, to the extent permitted by applicable law. Contractor is responsible for participating only in Company-authorized communications and for following any required notice or consent procedures provided by Company."))
    story.extend(section("10. Confidentiality", "Contractor will have access to confidential and proprietary Company information, including but not limited to client information, leads, prospects, pricing, scripts, systems, processes, marketing strategies, vendor information, login credentials, documents, communications, and business plans.", "Contractor agrees not to disclose, copy, misuse, sell, share, or use confidential information for any purpose outside authorized Company work. This obligation continues after the agreement ends."))
    story.extend(section("11. Intellectual Property & Work Product", "All work product created for Company, including documents, spreadsheets, reports, databases, captions, social media content, templates, workflows, research, lists, automations, and other materials, belongs exclusively to Company.", "To the extent ownership does not automatically transfer, Contractor assigns all rights, title, and interest in the work product to Company."))
    story.extend(section("12. Non-Solicitation, Non-Circumvention & Limited Non-Compete", "During the term of this agreement and for twelve (12) months after termination, Contractor may not directly or indirectly solicit, divert, contact for personal business, accept business from, or bypass Company with respect to any Company client, lead, prospect, vendor, agent, partner, investor, or business opportunity learned through Contractor's work with Company.", "Contractor also agrees that, during the term of this agreement and for twelve (12) months after termination, Contractor will not provide the same or substantially similar virtual assistant, lead management, CRM, client support, marketing support, or administrative services to any direct competitor of Company with whom Contractor had contact, gained confidential information about, or supported through Company work.", "This restriction is intended to be limited to protecting Company's confidential information, client relationships, leads, business opportunities, and goodwill. It does not prevent Contractor from earning a living generally or working in unrelated industries or roles."))
    story.extend(section("13. No Benefits; Taxes", "Contractor is responsible for all taxes, insurance, equipment, internet, workspace, and government obligations in Contractor's jurisdiction. Company will not provide employee benefits, paid leave, health insurance, retirement benefits, unemployment insurance, workers' compensation, or tax withholding unless required by law."))
    story.extend(section("14. Expenses", "Contractor may not incur expenses on behalf of Company unless approved in writing in advance. Approved expenses must be supported by receipts."))
    story.extend(section("15. At-Will Termination", "This engagement is at will. Either party may terminate this agreement at any time, with or without cause, and with or without advance notice, subject to payment for approved work actually performed before termination and any deductions or offsets permitted under this agreement.", "Company may terminate immediately for confidentiality violations, security concerns, misconduct, poor performance, unauthorized account use, dishonesty, missed deadlines, abandonment of work, unauthorized outsourcing or delegation, or breach of this agreement.", "Upon termination, Contractor must stop using Company systems and return or delete all Company materials upon request. Any outstanding advance may be deducted from Contractor's final payout."))
    story.extend(section("16. Independent Contractor Relationship", "Contractor controls the manner and means of performing services, subject to Company's right to approve deliverables, set business priorities, protect confidential information, and require deadlines. Nothing in this agreement creates an employment relationship."))
    story.extend(section("17. Governing Law & Dispute Resolution", "This agreement will be governed by the laws of the State of Georgia. Any dispute will be resolved by binding arbitration in Fulton County, Georgia, unless Company elects to seek injunctive relief for confidentiality, intellectual property, non-solicitation, non-circumvention, non-compete, or security violations."))
    story.extend(section("18. Electronic Signature", "This agreement may be signed electronically by DocuSign, Adobe Sign, PDF signature, email confirmation, or similar electronic means."))

    story.extend([Spacer(1, 0.12 * inch), Table([[signature_box("Company", "Meridian Collective Group"), signature_box("Contractor", "Virtual Assistant")]], colWidths=[3.15 * inch, 3.15 * inch], style=[("VALIGN", (0, 0), (-1, -1), "TOP")])])

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    print(OUT)


if __name__ == "__main__":
    build()
