import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function twilioEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function recordingSidFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/Recordings\/(RE[a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const recordingSid = req.nextUrl.searchParams.get("sid") || recordingSidFromUrl(req.nextUrl.searchParams.get("url"));
  if (!recordingSid || !/^RE[a-zA-Z0-9]+$/.test(recordingSid)) {
    return NextResponse.json({ error: "Missing recording SID." }, { status: 400 });
  }

  try {
    const accountSid = twilioEnv("TWILIO_ACCOUNT_SID");
    const authToken = twilioEnv("TWILIO_AUTH_TOKEN");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      cache: "no-store",
    });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Could not fetch recording." }, { status: response.status || 502 });
    }
    return new NextResponse(response.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": response.headers.get("content-type") || "audio/mpeg",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not fetch recording." }, { status: 500 });
  }
}
