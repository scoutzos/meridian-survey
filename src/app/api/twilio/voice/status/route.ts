import { NextRequest, NextResponse } from "next/server";
import { saveTwilioVoiceEvent, twilioFormToVoiceEvent, validateTwilioWebhook } from "@/lib/twilio-voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  if (!validateTwilioWebhook(req, formData)) return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  for (const [key, value] of Array.from(req.nextUrl.searchParams.entries())) {
    if (!formData.has(key)) formData.set(key, value);
  }
  const event = await twilioFormToVoiceEvent(formData, "status").catch(error => {
    console.error("Could not normalize Twilio status voice event.", error);
    return null;
  });
  if (event) {
    await saveTwilioVoiceEvent(event).catch(error => {
      console.error("Could not save Twilio status voice event.", error);
    });
  }
  return NextResponse.json({ ok: true });
}
