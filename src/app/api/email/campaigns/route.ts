import { NextRequest, NextResponse } from "next/server";
import {
  createEmailCampaignDraft,
  listEmailCampaignCenter,
  sendCampaignTestEmail,
  sendEmailCampaign,
  sendSavedEmailCampaign,
  supabaseEmailAdmin,
} from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 120;

type CampaignBody = {
  action?: "draft" | "send" | "send-existing" | "test";
  campaignId?: string;
  mailboxId?: string;
  templateId?: string | null;
  name?: string;
  subject?: string;
  text?: string;
  html?: string | null;
  manualRecipients?: string[] | string;
  includeCrmAudience?: boolean;
  crmContactTypes?: string[];
  testRecipient?: string;
  actor?: string | null;
};

export async function GET() {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  try {
    return NextResponse.json(await listEmailCampaignCenter(supabase));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load campaigns." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const body = await req.json().catch(() => ({})) as CampaignBody;

  try {
    if (body.action === "send-existing") {
      if (!body.campaignId) return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });
      const campaign = await sendSavedEmailCampaign(supabase, body.campaignId);
      return NextResponse.json({ ok: true, campaign });
    }

    if (!body.mailboxId) return NextResponse.json({ error: "Missing mailboxId." }, { status: 400 });
    if (body.action === "test") {
      const test = await sendCampaignTestEmail(supabase, {
        mailboxId: body.mailboxId,
        templateId: body.templateId || null,
        subject: body.subject || "",
        text: body.text || "",
        html: body.html || null,
        to: body.testRecipient || "",
        actor: body.actor || null,
      });
      return NextResponse.json({ ok: true, test });
    }

    const input = {
      mailboxId: body.mailboxId,
      templateId: body.templateId || null,
      name: body.name || "",
      subject: body.subject || "",
      text: body.text || "",
      html: body.html || null,
      manualRecipients: body.manualRecipients || "",
      includeCrmAudience: Boolean(body.includeCrmAudience),
      crmContactTypes: body.crmContactTypes || [],
      actor: body.actor || null,
    };
    const campaign = body.action === "draft"
      ? await createEmailCampaignDraft(supabase, input)
      : await sendEmailCampaign(supabase, input);
    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send campaign." }, { status: 400 });
  }
}
