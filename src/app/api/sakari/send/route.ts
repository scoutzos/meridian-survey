import { NextRequest, NextResponse } from "next/server";
import { sendSakariSms } from "@/lib/communications";
import type { MessageMediaAttachment } from "@/lib/communications";

export const runtime = "nodejs";
export const maxDuration = 30;

interface SendSmsBody {
  toNumber?: string;
  message?: string;
  actor?: string;
  leadId?: string | null;
  dealId?: string | null;
  media?: MessageMediaAttachment[];
}

export async function POST(req: NextRequest) {
  let body: SendSmsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid SMS request JSON." }, { status: 400 });
  }

  const toNumber = body.toNumber?.trim();
  const message = body.message?.trim();
  if (!toNumber) return NextResponse.json({ error: "Missing recipient phone number." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Missing SMS message." }, { status: 400 });
  if (message.length > 1200) return NextResponse.json({ error: "SMS message is too long." }, { status: 400 });
  const media = (body.media ?? []).filter(item => item?.url);
  if (media.length > 3) return NextResponse.json({ error: "MMS is limited to 3 images per message." }, { status: 400 });

  const { event, error } = await sendSakariSms({
    toNumber,
    message,
    actor: body.actor?.trim() || "Meridian",
    leadId: body.leadId ?? null,
    dealId: body.dealId ?? null,
    media,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({ ok: true, eventId: event?.id ?? null });
}
