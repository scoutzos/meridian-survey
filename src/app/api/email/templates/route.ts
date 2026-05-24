import { NextRequest, NextResponse } from "next/server";
import { saveEmailTemplate, supabaseEmailAdmin } from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 30;

type TemplateBody = {
  mailboxId?: string | null;
  name?: string;
  description?: string | null;
  subject?: string;
  text?: string;
  html?: string | null;
  actor?: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const body = await req.json().catch(() => ({})) as TemplateBody;

  try {
    const template = await saveEmailTemplate(supabase, {
      mailboxId: body.mailboxId || null,
      name: body.name || "",
      description: body.description || null,
      subject: body.subject || "",
      text: body.text || "",
      html: body.html || null,
      actor: body.actor || null,
    });
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save template." }, { status: 400 });
  }
}
