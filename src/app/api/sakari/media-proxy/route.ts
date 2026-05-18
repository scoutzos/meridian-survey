import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function getSakariToken(): Promise<{ token: string | null; error: string | null }> {
  const clientId = process.env.SAKARI_CLIENT_ID;
  const clientSecret = process.env.SAKARI_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { token: null, error: "Missing Sakari credentials." };
  const response = await fetch("https://api.sakari.io/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { token: null, error: `Sakari auth failed: ${JSON.stringify(data).slice(0, 160)}` };
  const token = typeof data.access_token === "string" ? data.access_token : null;
  return { token, error: token ? null : "Sakari auth did not return a token." };
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "Missing media URL." }, { status: 400 });
  let mediaUrl: URL;
  try {
    mediaUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid media URL." }, { status: 400 });
  }
  if (mediaUrl.hostname !== "api.sakari.io" || !mediaUrl.pathname.includes("/media/")) {
    return NextResponse.json({ error: "Unsupported media URL." }, { status: 400 });
  }

  const { token, error } = await getSakariToken();
  if (error || !token) return NextResponse.json({ error: error || "Could not authenticate with Sakari." }, { status: 500 });

  const response = await fetch(mediaUrl.toString(), {
    headers: {
      Accept: "image/*,application/octet-stream",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    return NextResponse.json({ error: `Could not fetch Sakari media (${response.status}).` }, { status: response.status });
  }
  const bytes = await response.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": response.headers.get("content-type") || "application/octet-stream",
    },
  });
}
