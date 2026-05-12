import { NextRequest, NextResponse } from "next/server";
import { createTwilioVoiceToken, meridianClientIdentity } from "@/lib/twilio-voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { actor?: string };
  try {
    return NextResponse.json({
      token: createTwilioVoiceToken(body.actor),
      identity: meridianClientIdentity(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create Twilio token." }, { status: 500 });
  }
}
