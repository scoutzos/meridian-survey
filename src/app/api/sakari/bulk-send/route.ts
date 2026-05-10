import { NextRequest, NextResponse } from "next/server";
import { sendSakariBulkSms } from "@/lib/communications";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BulkSmsBody {
  recipients?: Array<{ toNumber?: string; leadId?: string; label?: string | null }>;
  message?: string;
  actor?: string;
}

export async function POST(req: NextRequest) {
  let body: BulkSmsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid bulk SMS request JSON." }, { status: 400 });
  }

  const message = body.message?.trim();
  const recipients = (body.recipients ?? [])
    .map(recipient => ({
      toNumber: recipient.toNumber?.trim() ?? "",
      leadId: recipient.leadId?.trim() ?? "",
      label: recipient.label ?? null,
    }))
    .filter(recipient => recipient.toNumber && recipient.leadId);

  if (!message) return NextResponse.json({ error: "Missing bulk SMS message." }, { status: 400 });
  if (message.length > 1200) return NextResponse.json({ error: "SMS message is too long." }, { status: 400 });
  if (recipients.length === 0) return NextResponse.json({ error: "No eligible recipients selected." }, { status: 400 });
  if (recipients.length > 500) return NextResponse.json({ error: "Bulk sends are limited to 500 recipients at a time." }, { status: 400 });

  const result = await sendSakariBulkSms({
    recipients,
    message,
    actor: body.actor?.trim() || "Meridian",
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, sent: result.sent, eventIds: result.events.map(event => event.id) });
}
