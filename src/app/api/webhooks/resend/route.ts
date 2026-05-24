import { NextRequest, NextResponse } from "next/server";
import {
  ingestReceivedEmail,
  markWebhookProcessed,
  parseAndVerifyResendWebhook,
  recordResendWebhookEvent,
  supabaseEmailAdmin,
  updateMessageStatusFromWebhook,
} from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase email inbox is not configured." }, { status: 500 });
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  if (!svixId) return NextResponse.json({ error: "Missing svix-id header." }, { status: 400 });

  let event: ReturnType<typeof parseAndVerifyResendWebhook>;
  try {
    event = parseAndVerifyResendWebhook(payload, req.headers);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Resend webhook." }, { status: 400 });
  }

  try {
    const { duplicate } = await recordResendWebhookEvent(supabase, svixId, event);
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true });

    if (event.type === "email.received") {
      const emailId =
        typeof event.data?.email_id === "string"
          ? event.data.email_id
          : typeof event.data?.id === "string"
            ? event.data.id
            : null;
      if (!emailId) throw new Error("Missing Resend received email id.");
      await ingestReceivedEmail(supabase, emailId);
    } else if (event.type.startsWith("email.")) {
      await updateMessageStatusFromWebhook(supabase, event);
    }

    await markWebhookProcessed(supabase, svixId);
    return NextResponse.json({ ok: true, type: event.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process Resend webhook.";
    await markWebhookProcessed(supabase, svixId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
