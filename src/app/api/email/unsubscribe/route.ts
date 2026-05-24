import { NextRequest, NextResponse } from "next/server";
import { supabaseEmailAdmin, unsubscribeEmailRecipient } from "@/lib/email-inbox-server";

export const runtime = "nodejs";
export const maxDuration = 30;

function html(message: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title></head><body style="font-family:Inter,Arial,sans-serif;margin:40px;color:#1c2d30"><main style="max-width:620px"><h1 style="font-family:Georgia,serif;font-weight:500">Email preferences updated</h1><p>${message}</p></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function unsubscribe(req: NextRequest) {
  const supabase = supabaseEmailAdmin();
  if (!supabase) return html("This unsubscribe link is temporarily unavailable.");

  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token) return html("This unsubscribe link is missing its token.");

  const email = await unsubscribeEmailRecipient(supabase, token);
  if (!email) return html("This unsubscribe link is expired or invalid.");
  return html(`${email} has been removed from future portal campaign emails.`);
}

export async function GET(req: NextRequest) {
  return unsubscribe(req);
}

export async function POST(req: NextRequest) {
  return unsubscribe(req);
}
