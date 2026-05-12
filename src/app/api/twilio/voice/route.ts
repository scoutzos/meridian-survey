import { NextRequest, NextResponse } from "next/server";
import { outboundDialTwiMl, saveTwilioVoiceEvent, twilioFormToVoiceEvent, validateTwilioWebhook } from "@/lib/twilio-voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  if (!validateTwilioWebhook(req, formData)) return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  const event = await twilioFormToVoiceEvent(formData, "outbound");
  await saveTwilioVoiceEvent({ ...event, direction: "outbound", status: event.status || "initiated" });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const twiml = outboundDialTwiMl({
    to: formData.get("To")?.toString() ?? "",
    leadId: formData.get("leadId")?.toString() || event.leadId,
    dealId: formData.get("dealId")?.toString() || event.dealId,
    baseUrl,
  });

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
