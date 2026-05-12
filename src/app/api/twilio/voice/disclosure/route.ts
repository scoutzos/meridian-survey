import { NextRequest, NextResponse } from "next/server";
import { recordingDisclosureTwiMl, validateTwilioWebhook } from "@/lib/twilio-voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  if (!validateTwilioWebhook(req, formData)) return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  return new NextResponse(recordingDisclosureTwiMl(), {
    headers: { "Content-Type": "text/xml" },
  });
}
