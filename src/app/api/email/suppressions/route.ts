import { NextRequest, NextResponse } from "next/server";
import { deleteEmailSuppression, saveEmailSuppression, supabaseEmailAdmin } from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 30;

type SuppressionBody = {
  id?: string;
  email?: string;
  reason?: "unsubscribed" | "bounced" | "complained" | "blocked";
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const body = await req.json().catch(() => ({})) as SuppressionBody;
  try {
    const suppression = await saveEmailSuppression(supabase, {
      email: body.email || "",
      reason: body.reason || "blocked",
      notes: body.notes || null,
    });
    return NextResponse.json({ ok: true, suppression });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save suppression." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });

  const body = await req.json().catch(() => ({})) as SuppressionBody;
  if (!body.id) return NextResponse.json({ error: "Missing suppression id." }, { status: 400 });

  try {
    await deleteEmailSuppression(supabase, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove suppression." }, { status: 400 });
  }
}
