import { NextRequest, NextResponse } from "next/server";
import { inboundDialTwiMl, saveTwilioVoiceEvent, twilioFormToVoiceEvent, validateTwilioWebhook } from "@/lib/twilio-voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  if (!validateTwilioWebhook(req, formData)) return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  const event = await twilioFormToVoiceEvent(formData, "inbound").catch(error => {
    console.error("Could not normalize Twilio inbound voice event.", error);
    return null;
  });
  if (event) {
    await saveTwilioVoiceEvent({ ...event, direction: "inbound", status: event.status || "ringing" }).catch(error => {
      console.error("Could not save Twilio inbound voice event.", error);
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return new NextResponse(inboundDialTwiMl(baseUrl, event?.leadId, event?.dealId), {
    headers: { "Content-Type": "text/xml" },
  });
}
