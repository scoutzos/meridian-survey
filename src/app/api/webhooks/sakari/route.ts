import { NextRequest, NextResponse } from "next/server";
import { handleSakariWebhook } from "@/lib/communications";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid Sakari webhook JSON." }, { status: 400 });
  }

  const expectedSecret = process.env.SAKARI_WEBHOOK_SECRET;
  if (expectedSecret) {
    const received = req.headers.get("x-meridian-webhook-secret") || req.nextUrl.searchParams.get("secret");
    if (received !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
    }
  }

  const { event, error } = await handleSakariWebhook(body as Parameters<typeof handleSakariWebhook>[0]);
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    eventId: event?.id ?? null,
    matchedLeadId: event?.matched_lead_id ?? null,
    matchedDealId: event?.matched_deal_id ?? null,
  });
}
