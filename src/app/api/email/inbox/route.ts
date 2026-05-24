import { NextRequest, NextResponse } from "next/server";
import { listEmailInbox, markEmailThreadRead, supabaseEmailAdmin, updateEmailThreadStatus } from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const params = req.nextUrl.searchParams;
  try {
    const payload = await listEmailInbox(supabase, {
      mailboxId: params.get("mailboxId"),
      threadId: params.get("threadId"),
      status: params.get("status") || "open",
      query: params.get("q"),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load inbox." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const body = await req.json().catch(() => ({})) as { threadId?: string; action?: string; status?: "open" | "closed" | "archived" };
  if (!body.threadId) return NextResponse.json({ error: "Missing threadId." }, { status: 400 });

  try {
    if (body.action === "mark-read") {
      await markEmailThreadRead(supabase, body.threadId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "set-status" && body.status) {
      await updateEmailThreadStatus(supabase, body.threadId, body.status);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unsupported inbox action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update inbox." }, { status: 500 });
  }
}
