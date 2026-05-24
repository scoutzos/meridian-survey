import { NextRequest, NextResponse } from "next/server";
import { getAttachmentRedirectUrl, supabaseEmailAdmin } from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: NextRequest, { params }: { params: { attachmentId: string } }) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const url = await getAttachmentRedirectUrl(supabase, params.attachmentId);
  if (!url) return NextResponse.json({ error: "Attachment is not available." }, { status: 404 });
  return NextResponse.redirect(url);
}
