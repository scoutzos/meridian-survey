import { NextRequest, NextResponse } from "next/server";
import { sendPortalEmail, supabaseEmailAdmin } from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type SendBody = {
  mailboxId?: string;
  to?: string[] | string;
  cc?: string[] | string;
  bcc?: string[] | string;
  subject?: string;
  text?: string;
  html?: string | null;
  threadId?: string | null;
  actor?: string | null;
};

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(item => item.trim()).filter(Boolean);
  return [];
}

export async function POST(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const body = await req.json().catch(() => ({})) as SendBody;
  if (!body.mailboxId) return NextResponse.json({ error: "Missing mailboxId." }, { status: 400 });

  try {
    const message = await sendPortalEmail(supabase, {
      mailboxId: body.mailboxId,
      to: list(body.to),
      cc: list(body.cc),
      bcc: list(body.bcc),
      subject: body.subject || "",
      text: body.text || "",
      html: body.html || null,
      threadId: body.threadId || null,
      actor: body.actor || null,
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send email." }, { status: 400 });
  }
}
